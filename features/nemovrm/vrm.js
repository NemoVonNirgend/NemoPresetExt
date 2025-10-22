import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from './lib/jsm/loaders/FBXLoader.js';
import { OrbitControls } from './lib/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { loadBVHAnimation, loadMixamoAnimation } from './animationLoader.js';
import { environmentSystem } from './environment.js';

import { getRequestHeaders, saveSettings, saveSettingsDebounced, sendMessageAsUser } from '../../../../../../script.js';
import { getContext, extension_settings, getApiUrl, doExtrasFetch, modules } from '../../../../../extensions.js';

import {
    MODULE_NAME,
    DEBUG_PREFIX,
    VRM_CANVAS_ID,
    FALLBACK_EXPRESSION,
    ANIMATION_FADE_TIME,
    SPRITE_DIV,
    VN_MODE_DIV,
    HITBOXES
} from "./constants.js";

import {
    currentChatMembers,
    getExpressionLabel
} from './utils.js';

import {
    delay
} from '../../../../../utils.js';

import {
    animations_files
} from './ui.js';

export {
    loadScene,
    loadAllModels,
    setModel,
    unloadModel,
    getVRM,
    setExpression,
    setMotion,
    updateExpression,
    talk,
    updateModel,
    updateCharacterPosition,
    updateCharacterRotation,
    updateCharacterHeadLook,
    resetCharacterHeadLook,
    faceCamera,
    getCharacterPosition,
    currentAvatars,
    renderer,
    camera,
    scene,
    VRM_CONTAINER_NAME,
    clearModelCache,
    clearAnimationCache,
    setLight,
    setBackground,
    loadEnvironmentAsset,
    addInteractiveObject,
    playAnimationSequence,
    getCurrentAnimationDuration,
    getAnimationFileDuration,
    getProceduralAnimationSystem
}

const VRM_CONTAINER_NAME = "VRM_CONTAINER";
const VRM_COLLIDER_NAME = "VRM_COLLIDER"

// Avatars
let currentAvatars = {} // contain loaded avatar variables

// Caches
let models_cache = {};
let animations_cache = {};
let tts_lips_sync_job_id = 0;

// 3D Scene
let renderer = undefined;
let scene = undefined;
let camera = undefined;
let light = undefined;

// gltf and vrm
let currentInstanceId = 0;
let modelId = 0;
let clock = undefined;
const lookAtTarget = new THREE.Object3D();

// background
let background = undefined;

// debug
const gridHelper = new THREE.GridHelper( 20, 20 );
const axesHelper = new THREE.AxesHelper( 10 );


// animate
function animate() {
    requestAnimationFrame( animate );
    if (renderer !== undefined && scene !== undefined && camera !== undefined) {
        const deltaTime = clock.getDelta();
        const time = Date.now();

        for(const character in currentAvatars) {
            const vrm = currentAvatars[character]["vrm"];
            const mixer = currentAvatars[character]["animation_mixer"];
            
            // Look at camera
            if (extension_settings.vrm.follow_camera)
                vrm.lookAt.target = lookAtTarget;
            else
                vrm.lookAt.target = null;

            vrm.update( deltaTime );
            mixer.update( deltaTime );
            
            // Debug animation state every 2 seconds and check for broken states
            if (time % 2000 < 100) {
                const motionAnimation = currentAvatars[character]["motion"]["animation"];
                if (motionAnimation) {
                    const isRunning = motionAnimation.isRunning();
                    const weight = motionAnimation.getEffectiveWeight();
                    const terminated = motionAnimation.terminated;
                    
                    console.debug(DEBUG_PREFIX, `${character} animation debug:`, {
                        isRunning: isRunning,
                        weight: weight,
                        time: motionAnimation.time,
                        duration: motionAnimation.getClip().duration,
                        terminated: terminated,
                        motionName: currentAvatars[character]["motion"]["name"]
                    });
                    
                    // Detect broken animation state and attempt recovery
                    if ((!isRunning && !terminated) || (isRunning && weight === 0)) {
                        console.warn(DEBUG_PREFIX, `${character} animation appears stuck - running: ${isRunning}, weight: ${weight}, terminated: ${terminated}. Attempting recovery.`);
                        try {
                            // Stop all other animations that might be interfering
                            const mixer = currentAvatars[character]["animation_mixer"];
                            if (mixer) {
                                // Stop all actions except the current one
                                mixer.stopAllAction();
                            }
                            
                            motionAnimation.reset();
                            motionAnimation.setEffectiveWeight(1.0);
                            motionAnimation.setEffectiveTimeScale(1.0);
                            motionAnimation.play();
                            motionAnimation.terminated = false;
                            console.debug(DEBUG_PREFIX, `${character} animation recovery attempted - weight set to 1.0`);
                        } catch (error) {
                            console.error(DEBUG_PREFIX, `${character} animation recovery failed:`, error);
                            // Trigger fallback through behavior tree if available
                            if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
                                const fallbackAnimation = "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh";
                                console.warn(DEBUG_PREFIX, `${character} using emergency fallback animation: ${fallbackAnimation}`);
                                window.VRM_BEHAVIOR_TREES[character].setMotionProtected(character, fallbackAnimation, true, true);
                            }
                        }
                    }
                } else {
                    // No animation at all - this should not happen
                    console.warn(DEBUG_PREFIX, `${character} has no motion animation - this should not happen`);
                    if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
                        const fallbackAnimation = "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh";
                        console.warn(DEBUG_PREFIX, `${character} setting emergency animation: ${fallbackAnimation}`);
                        window.VRM_BEHAVIOR_TREES[character].setMotionProtected(character, fallbackAnimation, true, true);
                    }
                }
            }

            // Update control box
            const objectContainer = currentAvatars[character]["objectContainer"];
            const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
            hips.getWorldPosition(currentAvatars[character]["collider"].position);
            //objectContainer.worldToLocal(currentAvatars[character]["collider"].position);
            hips.getWorldQuaternion(currentAvatars[character]["collider"].quaternion);
            currentAvatars[character]["collider"].scale.copy(objectContainer.scale);
            currentAvatars[character]["collider"].visible = extension_settings.vrm.show_grid;

            // Update hitbox
            for (const body_part in currentAvatars[character]["hitboxes"]) {
                const bone = vrm.humanoid?.getNormalizedBoneNode(HITBOXES[body_part]["bone"]);
                if (bone !== null) {
                    bone.getWorldPosition(currentAvatars[character]["hitboxes"][body_part]["offsetContainer"].position);
                    bone.getWorldQuaternion(currentAvatars[character]["hitboxes"][body_part]["offsetContainer"].quaternion);
                    currentAvatars[character]["hitboxes"][body_part]["offsetContainer"].scale.copy(objectContainer.scale);
                    currentAvatars[character]["hitboxes"][body_part]["offsetContainer"].visible = extension_settings.vrm.show_grid;
                }
            }
        }
        // Show/hide helper grid
        gridHelper.visible = extension_settings.vrm.show_grid;
        axesHelper.visible = extension_settings.vrm.show_grid;

        renderer.render( scene, camera );
    }
}

animate();

async function loadScene() {
    clock = new THREE.Clock();
    currentAvatars = {};
    models_cache = {};
    animations_cache = {};
    const instanceId = currentInstanceId + 1;
    currentInstanceId = instanceId;

    // Delete the canvas
    if (document.getElementById(VRM_CANVAS_ID) !== null) {
        document.getElementById(VRM_CANVAS_ID).remove();
        // Hide sprite divs
    }
    
    $('#' + SPRITE_DIV).addClass('vrm-hidden');
    $('#' + VN_MODE_DIV).addClass('vrm-hidden');

    if (!extension_settings.vrm.enabled) {
        $('#' + SPRITE_DIV).removeClass('vrm-hidden');
        $('#' + VN_MODE_DIV).removeClass('vrm-hidden');
        return
    }

    clock.start();

    // renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias : true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.domElement.id = VRM_CANVAS_ID;
    document.body.appendChild( renderer.domElement );

    // camera
    camera = new THREE.PerspectiveCamera( 50.0, window.innerWidth / window.innerHeight, 0.1, 100.0 );
    //const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.set( 0.0, 1.0, 5.0 );

    // camera controls
    //const controls = new OrbitControls( camera, renderer.domElement );
    //controls.screenSpacePanning = true;
    //controls.target.set( 0.0, 1.0, 0.0 );
    //controls.update();

    // scene
    scene = new THREE.Scene();
    
    // Grid debuging helpers
    scene.add( gridHelper );
    scene.add( axesHelper );
    gridHelper.visible = extension_settings.vrm.show_grid;
    axesHelper.visible = extension_settings.vrm.show_grid;

    // light
    light = new THREE.DirectionalLight();
    light.position.set( 1.0, 1.0, 1.0 ).normalize();
    setLight(extension_settings.vrm.light_color, extension_settings.vrm.light_intensity);
    scene.add( light );

    // lookat target
    camera.add( lookAtTarget );

    // Initialize environment system
    await environmentSystem.initialize();

    //current_characters = currentChatMembers();
    //await loadAllModels(current_characters);

    //console.debug(DEBUG_PREFIX,"DEBUG",renderer);
}

async function loadAllModels(current_characters) {
    // Unload models
    for(const character in currentAvatars) {
        await unloadModel(character);
    }

    if (extension_settings.vrm.enabled) {
        // Load new characters models
        for(const character of current_characters) {
            const model_path = extension_settings.vrm.character_model_mapping[character];
            if (model_path !== undefined) {
                console.debug(DEBUG_PREFIX,"Loading VRM model of",character,":",model_path);
                await setModel(character,model_path);
            }
        }
    }
}

async function setModel(character,model_path) {
    let model;
    // Model is cached
    if (models_cache[model_path] !== undefined) {
        model = models_cache[model_path];
        await initModel(model);
        console.debug(DEBUG_PREFIX,"Model loaded from cache:",model_path);
    }
    else {
        model = await loadModel(model_path);
    }

    await unloadModel(character);

    // Error occured
    if (model === null) {
        extension_settings.vrm.character_model_mapping[character] = undefined;
        return;
    }

    // Set as character model and start animations
    modelId++;
    currentAvatars[character] = model;
    currentAvatars[character]["id"] = modelId;
    currentAvatars[character]["objectContainer"].name = VRM_CONTAINER_NAME+"_"+character;
    currentAvatars[character]["collider"].name = VRM_COLLIDER_NAME+"_"+character;

    // Load default expression/motion
    const expression = extension_settings.vrm.model_settings[model_path]['animation_default']['expression'];
    let motion =  extension_settings.vrm.model_settings[model_path]['animation_default']['motion'];

    // Safety check for motion path
    if (!motion || motion === 'none') {
        console.debug(DEBUG_PREFIX,"Default motion is invalid, using fallback neutral animation");
        motion = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
    }

    // Delegate to BehaviorTree for animation control
    if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
        const behaviorTree = window.VRM_BEHAVIOR_TREES[character];
        if (expression !== undefined && expression != "none") {
            console.debug(DEBUG_PREFIX,"Set default expression to",expression,"via BehaviorTree");
            await behaviorTree.setExpressionProtected(character, expression);
        }
        if (motion !== undefined && motion != "none") {
            console.debug(DEBUG_PREFIX,"Set default motion to",motion,"via BehaviorTree");
            await behaviorTree.setMotionProtected(character, motion, true);
        }
    } else {
        // Fallback if BehaviorTree not initialized (should not happen in normal flow)
        if (expression !== undefined && expression != "none") {
            console.debug(DEBUG_PREFIX,"Set default expression to",expression,"(fallback)");
            await setExpression(character, expression);
        }
        if (motion !== undefined && motion != "none") {
            console.debug(DEBUG_PREFIX,"Set default motion to",motion,"(fallback)");
            await setMotion(character, motion, true);
        }
    }

    if (extension_settings.vrm.blink)
        blink(character, modelId);
    textTalk(character, modelId);
    currentAvatars[character]["objectContainer"].visible = true;
    currentAvatars[character]["collider"].visible = extension_settings.vrm.show_grid;
    
    scene.add(currentAvatars[character]["objectContainer"]);
    scene.add(currentAvatars[character]["collider"]);
    for(const hitbox in currentAvatars[character]["hitboxes"])
        scene.add(currentAvatars[character]["hitboxes"][hitbox]["offsetContainer"]);
}

async function unloadModel(character) {
    // unload existing model
    if (currentAvatars[character] !== undefined) {
        console.debug(DEBUG_PREFIX,"Unloading avatar of",character);
        const container = currentAvatars[character]["objectContainer"];
        const collider = currentAvatars[character]["collider"];

        scene.remove(scene.getObjectByName(container.name));
        scene.remove(scene.getObjectByName(collider.name));
        for(const hitbox in currentAvatars[character]["hitboxes"]) {
            console.debug(DEBUG_PREFIX,"REMOVING",currentAvatars[character]["hitboxes"][hitbox]["offsetContainer"])
            scene.remove(scene.getObjectByName(currentAvatars[character]["hitboxes"][hitbox]["offsetContainer"].name));
        }

        // Stop and dispose of all animations for the character
        if (currentAvatars[character]["animation_mixer"]) {
            currentAvatars[character]["animation_mixer"].stopAllAction();
            currentAvatars[character]["animation_mixer"].uncacheRoot(currentAvatars[character]["vrm"].scene);
        }
        if (currentAvatars[character]["motion"]["animation"] !== null) {
            currentAvatars[character]["motion"]["animation"].stop();
            currentAvatars[character]["motion"]["animation"].terminated = true;
            currentAvatars[character]["motion"]["animation"] = null;
        }
        // Clear any pending animation requests for this character in BehaviorTree
        if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
            window.VRM_BEHAVIOR_TREES[character].clearPendingAnimations();
        }

        delete currentAvatars[character];

        container.visible = false;
        collider.visible = false;
        if (!extension_settings.vrm.models_cache) {
            await container.traverse(obj => obj.dispose?.());
            await collider.traverse(obj => obj.dispose?.());
        }
    }
}

async function loadModel(model_path) { // Only cache the model if character=null
    // gltf and vrm
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';

    loader.register( ( parser ) => {
        return new VRMLoaderPlugin( parser );
    } );

    let gltf;
    try {
        gltf = await loader.loadAsync(model_path,
            // called after loaded
            () => {
                console.debug(DEBUG_PREFIX,"Finished loading",model_path);
            },
            // called while loading is progressing
            ( progress ) => {
                const percent = Math.round(100.0 * ( progress.loaded / progress.total ));
                console.debug(DEBUG_PREFIX, 'Loading model...', percent, '%');
                $("#vrm_model_loading_percent").text(percent);
            },
            // called when loading has errors
            ( error ) => {
                console.debug(DEBUG_PREFIX,"Error when loading",model_path,":",error)
                toastr.error('Wrong avatar file:'+model_path, DEBUG_PREFIX + ' cannot load', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                return;
            }
        );
    }
    catch (error) {
        console.debug(DEBUG_PREFIX,"Error when loading",model_path,":",error)
        toastr.error('Wrong avatar file:'+model_path, DEBUG_PREFIX + ' cannot load', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return null;
    }

    const vrm = gltf.userData.vrm;
    const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode( 'hips' ).position.y;
    const vrmRootY = vrm.scene.position.y;
    const hipsHeight = Math.abs( vrmHipsY - vrmRootY ); // Used for offset center rotation and animation scaling

    // calling these functions greatly improves the performance
    VRMUtils.removeUnnecessaryVertices( gltf.scene );
    VRMUtils.removeUnnecessaryJoints( gltf.scene );

    // Disable frustum culling
    vrm.scene.traverse( ( obj ) => {
        obj.frustumCulled = false;
    } );

    // un-T-pose
    vrm.springBoneManager.reset();
    if (vrm.meta?.metaVersion === '1') {
        vrm.humanoid.getNormalizedBoneNode("rightUpperArm").rotation.z = -250;
        vrm.humanoid.getNormalizedBoneNode("rightLowerArm").rotation.z = 0.2;
        vrm.humanoid.getNormalizedBoneNode("leftUpperArm").rotation.z = 250;
        vrm.humanoid.getNormalizedBoneNode("leftLowerArm").rotation.z = -0.2;
    }
    else {
        vrm.humanoid.getNormalizedBoneNode("rightUpperArm").rotation.z = 250;
        vrm.humanoid.getNormalizedBoneNode("rightLowerArm").rotation.z = -0.2;
        vrm.humanoid.getNormalizedBoneNode("leftUpperArm").rotation.z = -250;
        vrm.humanoid.getNormalizedBoneNode("leftLowerArm").rotation.z = 0.2;
    }

    // Add vrm to scene
    VRMUtils.rotateVRM0(vrm); // rotate if the VRM is VRM0.0
    const scale = extension_settings.vrm.model_settings[model_path]["scale"];
    // Create a group to set model center as rotation/scaling origin
    const object_container = new THREE.Group(); // First container to scale/position center model
    object_container.visible = false;
    object_container.name = VRM_CONTAINER_NAME;
    object_container.model_path = model_path; // link to character for mouse controls
    object_container.scale.set(scale,scale,scale);
    object_container.position.y = 0.5; // offset to center model
    const verticalOffset = new THREE.Group(); // Second container to rotate center model
    verticalOffset.position.y = -hipsHeight; // offset model for rotate on "center"
    verticalOffset.add(vrm.scene)
    object_container.add(verticalOffset);
    //object_container.parent = scene;
    
    // Collider used to detect mouse click
    const boundingBox = new THREE.Box3(new THREE.Vector3(-0.5,-1.0,-0.5), new THREE.Vector3(0.5,1.0,0.5));
    const dimensions = new THREE.Vector3().subVectors( boundingBox.max, boundingBox.min );
    // make a BoxGeometry of the same size as Box3
    const boxGeo = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
    // move new mesh center so it's aligned with the original object
    const matrix = new THREE.Matrix4().setPosition(dimensions.addVectors(boundingBox.min, boundingBox.max).multiplyScalar( 0.5 ));
    boxGeo.applyMatrix4(matrix);
    // make a mesh
    const collider = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({
        visible: true,
        side: THREE.BackSide,
        wireframe: true,
        color:0xffff00
    }));
    collider.name = VRM_COLLIDER_NAME;
    collider.material.side = THREE.BackSide;
    //scene.add(collider);
    
    // Avatar dynamic settings
    const model = {
        "id": null,
        "model_path": model_path,
        "vrm": vrm, // the actual vrm object
        "hipsHeight": hipsHeight, // its original hips height, used for scaling loaded animation
        "objectContainer": object_container, // the actual 3d group containing the vrm scene, handle centered position/rotation/scaling
        "collider": collider,
        "expression": "none",
        "animation_mixer": new THREE.AnimationMixer(vrm.scene),
        "motion": {
            "name": "none",
            "animation": null
        },
        "talkEnd": 0,
        "hitboxes": {}
    };

    // Hit boxes
    if (extension_settings.vrm.hitboxes) {
        for(const body_part in HITBOXES)
        {
            const bone = vrm.humanoid.getNormalizedBoneNode(HITBOXES[body_part]["bone"])
            if (bone !== null) {
                const position = new THREE.Vector3();
                position.setFromMatrixPosition(bone.matrixWorld);
                console.debug(DEBUG_PREFIX,"Creating hitbox for",body_part,"at",position);

                const size = HITBOXES[body_part]["size"];
                const offset = HITBOXES[body_part]["offset"];

                // Collider used to detect mouse click
                const boundingBox = new THREE.Box3(new THREE.Vector3(-size.x,-size.y,-size.z), new THREE.Vector3(size.x,size.y,size.z));
                const dimensions = new THREE.Vector3().subVectors( boundingBox.max, boundingBox.min );
                // make a BoxGeometry of the same size as Box3
                const boxGeo = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
                // move new mesh center so it's aligned with the original object
                const matrix = new THREE.Matrix4().setPosition(dimensions.addVectors(boundingBox.min, boundingBox.max).multiplyScalar( 0.5 ));
                boxGeo.applyMatrix4(matrix);
                // make a mesh
                const collider = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({
                    visible: true,
                    side: THREE.BackSide,
                    wireframe: true,
                    color:HITBOXES[body_part]["color"]
                }));
                collider.name = body_part;
                if (vrm.meta?.metaVersion === '1')
                    collider.position.set(offset.x/hipsHeight,offset.y/hipsHeight,-offset.z/hipsHeight);
                else
                    collider.position.set(-offset.x/hipsHeight,offset.y/hipsHeight,offset.z/hipsHeight);
                // Create a offset container
                const offset_container = new THREE.Group(); // First container to scale/position center model
                offset_container.name = model_path+"_offsetContainer_hitbox_"+body_part;
                offset_container.visible = true;
                offset_container.add(collider);
                //scene.add(offset_container)

                //object_container.localToWorld(position);
                //position.add(new THREE.Vector3(offset.x,offset.y,offset.z));
                //collider.position.set(position.x,position.y,position.z);
                //scene.add(collider);

                model["hitboxes"][body_part] = {
                    "offsetContainer":offset_container,
                    "collider":collider
                }
            }
        }
    }

    //console.debug(DEBUG_PREFIX,vrm);

    // Cache model
    if (extension_settings.vrm.models_cache)
        models_cache[model_path] = model;

    await initModel(model);
    
    console.debug(DEBUG_PREFIX,"VRM fully loaded:",model_path);
    
    return model;
}

async function initModel(model) {
    const object_container = model["objectContainer"];
    const model_path = model["model_path"];

    object_container.scale.x = extension_settings.vrm.model_settings[model_path]['scale'];
    object_container.scale.y = extension_settings.vrm.model_settings[model_path]['scale'];
    object_container.scale.z = extension_settings.vrm.model_settings[model_path]['scale'];

    object_container.position.x = extension_settings.vrm.model_settings[model_path]['x'];
    object_container.position.y = extension_settings.vrm.model_settings[model_path]['y'];
    object_container.position.z = 0.0;

    object_container.rotation.x = extension_settings.vrm.model_settings[model_path]['rx'];
    object_container.rotation.y = extension_settings.vrm.model_settings[model_path]['ry'];
    object_container.rotation.z = 0.0;

    // Cache model animations
    if (extension_settings.vrm.animations_cache && animations_cache[model_path] === undefined) {
        animations_cache[model_path] = {};
        let defaultMotion = extension_settings.vrm.model_settings[model_path]['animation_default']['motion'];
        // Safety check for motion path
        if (!defaultMotion || defaultMotion === 'none') {
            defaultMotion = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
        }
        const animation_names = [defaultMotion]
        for (const i in extension_settings.vrm.model_settings[model_path]['classify_mapping']) {
            animation_names.push(extension_settings.vrm.model_settings[model_path]['classify_mapping'][i]["motion"]);
        }

        let count = 0;
        for (const file of animations_files) {
            count++;
            for (const i of animation_names) {
                if(file.includes(i) && animations_cache[model_path][file] === undefined) {
                    console.debug(DEBUG_PREFIX,"Loading animation",file,count,"/",animations_files.length)
                    const clip = await loadAnimation(model["vrm"], model["hipsHeight"], file);
                    if (clip !== undefined)
                        animations_cache[model_path][file] = clip;
                }
            }
        }

        console.debug(DEBUG_PREFIX,"Cached animations:",animations_cache[model_path]);
    }
}

async function setExpression(character, value) {
    if (currentAvatars[character] === undefined) {
        console.debug(DEBUG_PREFIX,"WARNING requested setExpression of character without vrm loaded:",character,"(loaded",currentAvatars,")");
        return;
    }

    const vrm = currentAvatars[character]["vrm"];
    const current_expression = currentAvatars[character]["expression"];
    console.debug(DEBUG_PREFIX,"Switch expression of",character,"from",current_expression,"to",value);
    
    if (value == "none")
        value = "neutral";

    // Rest all expressions
    for(const expression in vrm.expressionManager.expressionMap)
        vrm.expressionManager.setValue(expression, 0.0);

    vrm.expressionManager.setValue(value, 1.0);
    currentAvatars[character]["expression"] = value;
}

async function loadAnimation(vrm, hipsHeight, motion_file_path) {
    console.debug(DEBUG_PREFIX, 'loadAnimation called with path:', motion_file_path, 'type:', typeof motion_file_path);
    
    let clip;
    try {
        // Check if motion_file_path is valid
        if (!motion_file_path || typeof motion_file_path !== 'string') {
            console.error(DEBUG_PREFIX, 'Invalid motion_file_path:', motion_file_path);
            toastr.error('Wrong animation file format: ' + motion_file_path + ' (invalid path)', DEBUG_PREFIX + ' cannot play animation', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return null;
        }
        
        // Mixamo animation
        if (motion_file_path.endsWith(".fbx")) {
            console.debug(DEBUG_PREFIX,"Loading fbx file",motion_file_path);
            // Load animation
            clip = await loadMixamoAnimation(motion_file_path, vrm, hipsHeight);
        }
        else if (motion_file_path.endsWith(".bvh")) {
            console.debug(DEBUG_PREFIX,"Loading bvh file",motion_file_path);
            clip = await loadBVHAnimation(motion_file_path, vrm, hipsHeight);
        }
        else {
            console.error(DEBUG_PREFIX, 'Unsupported animation file format:', motion_file_path);
            toastr.error('Wrong animation file format: ' + motion_file_path + ' (unsupported format)', DEBUG_PREFIX + ' cannot play animation', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return null;
        }
    }
    catch(error) {
        console.error(DEBUG_PREFIX,"Something went wrong when loading animation file:",motion_file_path, error);
        toastr.error('Wrong animation file format:'+motion_file_path, DEBUG_PREFIX + ' cannot play animation', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return null;
    }
    
    // Final validation before returning
    if (!clip || clip === undefined) {
        console.error(DEBUG_PREFIX, 'Animation loading returned invalid clip for:', motion_file_path);
        return null;
    }
    
    return clip;
}

async function setMotion(character, motion_file_path, loop=false, force=false, random=true, removeRootMotion=false ) {
    console.debug(DEBUG_PREFIX, 'setMotion called for character:', character, 'with path:', motion_file_path, 'type:', typeof motion_file_path);
    
    // Safety check for motion path
    if (!motion_file_path || motion_file_path === 'none' || motion_file_path === 'undefined' || motion_file_path === undefined) {
        console.debug(DEBUG_PREFIX, 'Invalid motion path provided, using fallback neutral animation');
        motion_file_path = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
    }
    
    if (currentAvatars[character] === undefined) {
        console.debug(DEBUG_PREFIX,"WARNING requested setMotion of character without vrm loaded:",character,"(loaded",currentAvatars,")");
        return;
    }
    
    // Enhanced VRM readiness check
    const vrm = currentAvatars[character]["vrm"];
    const mixer = currentAvatars[character]["animation_mixer"];
    
    if (!vrm || !mixer) {
        console.warn(DEBUG_PREFIX, `VRM or mixer not ready for ${character}, vrm:`, !!vrm, "mixer:", !!mixer);
        // Queue the animation to be set later when VRM is ready
        setTimeout(() => setMotion(character, motion_file_path, loop, force, random, removeRootMotion), 100);
        return;
    }
    
    // Check if VRM is fully initialized
    if (!vrm.scene || !vrm.humanoid) {
        console.warn(DEBUG_PREFIX, `VRM not fully initialized for ${character}, scene:`, !!vrm.scene, "humanoid:", !!vrm.humanoid);
        // Queue the animation to be set later when VRM is ready
        setTimeout(() => setMotion(character, motion_file_path, loop, force, random, removeRootMotion), 200);
        return;
    }
    const model_path = extension_settings.vrm.character_model_mapping[character];
    const hipsHeight = currentAvatars[character]["hipsHeight"];
    const current_motion_name = currentAvatars[character]["motion"]["name"];
    const current_motion_animation= currentAvatars[character]["motion"]["animation"];
    let clip = undefined;

    console.debug(DEBUG_PREFIX,"Switch motion for",character,"from",current_motion_name,"to",motion_file_path,"loop=",loop,"force=",force,"random=",random);

    // Disable current animation
    if (motion_file_path == "none") {
        if (current_motion_animation !== null) {
            current_motion_animation.fadeOut(ANIMATION_FADE_TIME);
            current_motion_animation.terminated = true;
        }
        currentAvatars[character]["motion"]["name"] = "none";
        currentAvatars[character]["motion"]["animation"] = null;
        return;
    }

    // Pick random animationX
    // Extract filename from full path for comparison
    const baseFilename = motion_file_path.substring(motion_file_path.lastIndexOf('/') + 1);
    const filename = baseFilename.replace(/\.[^/.]+$/, "").replace(/\d+$/, "");
    if (random) {
        let same_motion = []
        for(const fullPath of animations_files) {
            // Extract filename from full path for comparison
            const animationFilename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
            const animationBaseName = animationFilename.replace(/\.[^/.]+$/, "").replace(/\d+$/, "");
            if (animationBaseName == filename)
                same_motion.push(fullPath)
        }
        if (same_motion.length > 0) {
            motion_file_path = same_motion[Math.floor(Math.random() * same_motion.length)];
            console.debug(DEBUG_PREFIX,"Picked a random animation among",same_motion,":",motion_file_path);
        } else {
            console.debug(DEBUG_PREFIX,"No matching animations found for",filename,", keeping original path");
        }
    }
    
    // Additional safety check after random selection
    if (!motion_file_path || motion_file_path === undefined) {
        console.warn(DEBUG_PREFIX, 'Motion path became undefined after random selection, using fallback');
        motion_file_path = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
    }

    // new animation
    if (current_motion_name != motion_file_path || loop || force) {

        if (animations_cache[model_path] !== undefined && animations_cache[model_path][motion_file_path] !== undefined) {
            clip = animations_cache[model_path][motion_file_path];
            console.debug(DEBUG_PREFIX, 'Using cached animation clip for:', motion_file_path);
        }
        else {
            clip = await loadAnimation(vrm, hipsHeight, motion_file_path);

            if (clip === null || clip === undefined) {
                console.error(DEBUG_PREFIX, 'Failed to load animation clip for path:', motion_file_path);
                // Try fallback animation to prevent animation cycle break
                if (motion_file_path !== '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh') {
                    console.warn(DEBUG_PREFIX, 'Attempting fallback to neutral.bvh animation');
                    return await setMotion(character, '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh', loop, force, false, removeRootMotion);
                }
                return;
            }

            if (extension_settings.vrm.animations_cache)
                animations_cache[model_path][motion_file_path] = clip;
        }

        if (removeRootMotion) {
            // Remove root motion from the animation
            const hipsTrack = clip.tracks.find(track => track.name.includes('hips.position'));
            if (hipsTrack) {
                const times = hipsTrack.times;
                const values = hipsTrack.values;
                const originalY = values; // Get the initial Y position

                for (let i = 0; i < times.length; i++) {
                    values[i * 3] = 0; // Set X to 0
                    values[i * 3 + 1] = originalY; // Keep original Y
                    values[i * 3 + 2] = 0; // Set Z to 0
                }
            }
        }

        // Final validation before creating animation action
        if (!clip || clip === undefined) {
            console.error(DEBUG_PREFIX, 'Animation clip is invalid:', clip, 'for path:', motion_file_path);
            return;
        }

        // create AnimationMixer for VRM
        const new_motion_animation = mixer.clipAction( clip );
        
        // Ensure the action is properly configured
        if (!new_motion_animation) {
            console.error(DEBUG_PREFIX, `Failed to create animation action for ${character}: ${motion_file_path}`);
            return;
        }

        // Improved cross-fading system with better error handling
        try {
            // Stop all other animations to prevent weight conflicts
            const mixer = currentAvatars[character]["animation_mixer"];
            if (mixer) {
                // Get all actions and stop them except the new one
                const actions = mixer._actions || [];
                for (const action of actions) {
                    if (action !== new_motion_animation) {
                        action.stop();
                        action.terminated = true;
                    }
                }
            }
            
            // Check if current_motion_animation is valid and running before attempting fadeOut
            if (current_motion_animation && current_motion_animation.isRunning() && !current_motion_animation.terminated) {
                const crossFadeTime = ANIMATION_FADE_TIME * 3.0; // Significantly increased fade time for much smoother transitions
                
                current_motion_animation.fadeOut(crossFadeTime);
                current_motion_animation.terminated = true;
                
                new_motion_animation
                    .reset()
                    .setEffectiveTimeScale(1)
                    .setEffectiveWeight(0)
                    .fadeIn(crossFadeTime)
                    .play();
                    
                console.debug(DEBUG_PREFIX, `Cross-fading from ${current_motion_name} to ${motion_file_path} over ${crossFadeTime}s`);
                
                // Ensure the new animation reaches full weight after fade
                setTimeout(() => {
                    if (currentAvatars[character] &&
                        currentAvatars[character]["motion"]["animation"] === new_motion_animation &&
                        !new_motion_animation.terminated) {
                        new_motion_animation.setEffectiveWeight(1.0);
                        console.debug(DEBUG_PREFIX, `${character} animation weight ensured at 1.0 after fade`);
                    }
                }, crossFadeTime * 1000 + 50);
            } else {
                new_motion_animation
                    .reset()
                    .setEffectiveTimeScale(1)
                    .setEffectiveWeight(1)
                    .play();
                    
                console.debug(DEBUG_PREFIX, `Starting new animation ${motion_file_path} immediately with weight: ${new_motion_animation.getEffectiveWeight()}`);
            }
            
            // Robust check if the animation is actually playing - give it a moment to start
            setTimeout(() => {
                if (currentAvatars[character] &&
                    currentAvatars[character]["motion"]["animation"] === new_motion_animation) {
                    
                    const isRunning = new_motion_animation.isRunning();
                    const weight = new_motion_animation.getEffectiveWeight();
                    
                    if (!isRunning || weight === 0) {
                        console.warn(DEBUG_PREFIX, `Animation ${motion_file_path} for ${character} has issues - running: ${isRunning}, weight: ${weight}. Forcing correction.`);
                        
                        new_motion_animation.enabled = true;
                        new_motion_animation.reset();
                        new_motion_animation.setEffectiveWeight(1.0);
                        new_motion_animation.setEffectiveTimeScale(1.0);
                        new_motion_animation.play();
                        new_motion_animation.terminated = false;
                        
                        console.debug(DEBUG_PREFIX, `${character} animation forced to play with weight 1.0`);
                    }
                }
            }, 100); // Small delay to allow proper initialization
            
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error during animation transition for ${character}:`, error);
            // Attempt to stop any problematic animation to prevent a stuck state
            if (new_motion_animation) {
                new_motion_animation.stop();
            }
            return;
        }
        
        new_motion_animation.terminated = false; // Mark as not terminated

        currentAvatars[character]["motion"]["name"] = motion_file_path;
        currentAvatars[character]["motion"]["animation"] = new_motion_animation;

        // Improved animation looping and timing
        if (loop) {
            // Set proper looping for continuous animations
            new_motion_animation.setLoop(THREE.LoopRepeat, Infinity);
        } else {
            // Set single play for non-looping animations
            new_motion_animation.setLoop(THREE.LoopOnce, 1);
            new_motion_animation.clampWhenFinished = true;
            
            // Schedule transition back to default motion after animation completes
            const transitionTime = Math.max(clip.duration * 1000 - ANIMATION_FADE_TIME * 500, 100);
            setTimeout(() => {
                // Enhanced check to ensure animation system is still valid
                if (currentAvatars[character] &&
                    currentAvatars[character]["motion"]["animation"] === new_motion_animation &&
                    !new_motion_animation.terminated &&
                    new_motion_animation.isRunning()) {
                    
                    let defaultMotion = extension_settings.vrm.model_settings[model_path]["animation_default"]["motion"];
                    // Safety check for motion path
                    if (!defaultMotion || defaultMotion === 'none') {
                        defaultMotion = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
                    }
                    
                    console.debug(DEBUG_PREFIX, `${character} non-looping animation completed, transitioning to default: ${defaultMotion}`);
                    
                    // Use BehaviorTree if available for smoother transitions
                    if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
                        window.VRM_BEHAVIOR_TREES[character].setMotionProtected(character, defaultMotion, true, false, false);
                    } else {
                        // Fallback to direct setMotion
                        setMotion(character, defaultMotion, true, false, false);
                    }
                }
            }, transitionTime);
        }

        //console.debug(DEBUG_PREFIX,"VRM animation",new_motion_animation);
        
    }
}

// Play a sequence of animations
async function playAnimationSequence(character, sequence) {
    if (currentAvatars[character] === undefined) {
        console.debug(DEBUG_PREFIX,"WARNING requested playAnimationSequence of character without vrm loaded:",character);
        return;
    }

    // Execute each animation in the sequence
    for (let i = 0; i < sequence.length; i++) {
        const animation = sequence[i];
        const isLast = i === sequence.length - 1;
        
        if (animation.type === "expression") {
            await setExpression(character, animation.value);
        } else if (animation.type === "motion") {
            // For sequences, we typically don't loop animations
            await setMotion(character, animation.value, false, true);
        }
        
        // Wait for the animation to complete before moving to the next one
        // (unless it's the last one and we want to keep it looping)
        if (!isLast && animation.type === "motion") {
            const model_path = extension_settings.vrm.character_model_mapping[character];
            const motion_file_path = animation.value;
            const filename = motion_file_path.replace(/\.[^/.]+$/, "").replace(/\d+$/, "");
            let same_motion = [];
            for(const file of animations_files) {
                if (file.replace(/\.[^/.]+$/, "").replace(/\d+$/, "") == filename)
                    same_motion.push(file);
            }
            const actual_motion_path = same_motion.length > 0 ? 
                same_motion[Math.floor(Math.random() * same_motion.length)] : motion_file_path;
            
            // Try to get duration from cache first
            let duration = 1000; // default 1 second
            if (animations_cache[model_path] && animations_cache[model_path][actual_motion_path]) {
                duration = animations_cache[model_path][actual_motion_path].duration * 1000;
            } else {
                // If not in cache, try to load it to get the duration
                const vrm = currentAvatars[character]["vrm"];
                const hipsHeight = currentAvatars[character]["hipsHeight"];
                const clip = await loadAnimation(vrm, hipsHeight, actual_motion_path);
                if (clip) {
                    duration = clip.duration * 1000;
                    // Cache it for future use
                    if (extension_settings.vrm.animations_cache) {
                        if (!animations_cache[model_path]) animations_cache[model_path] = {};
                        animations_cache[model_path][actual_motion_path] = clip;
                    }
                }
            }
            
            // Wait for the animation to finish
            await new Promise(resolve => setTimeout(resolve, duration));
        }
    }
}

// Get the duration of an animation
async function getAnimationFileDuration(character, motionFilePath) {
    if (currentAvatars[character] === undefined) {
        return 0;
    }
    
    const model_path = extension_settings.vrm.character_model_mapping[character];
    
    // Try to get duration from cache first
    if (animations_cache[model_path] && animations_cache[model_path][motionFilePath]) {
        return animations_cache[model_path][motionFilePath].duration;
    }
    
    // If not in cache, try to load it to get the duration
    try {
        const vrm = currentAvatars[character]["vrm"];
        const hipsHeight = currentAvatars[character]["hipsHeight"];
        const clip = await loadAnimation(vrm, hipsHeight, motionFilePath);
        if (clip) {
            // Cache it for future use
            if (extension_settings.vrm.animations_cache) {
                if (!animations_cache[model_path]) animations_cache[model_path] = {};
                animations_cache[model_path][motionFilePath] = clip;
            }
            return clip.duration;
        }
    } catch (error) {
        console.error(DEBUG_PREFIX, "Error getting animation duration:", error);
    }
    
    return 0;
}

// Update to work with behavior trees
async function updateExpression(chat_id) {
    const message = getContext().chat[chat_id];
    const character = message.name;
    const model_path = extension_settings.vrm.character_model_mapping[character];

    console.debug(DEBUG_PREFIX,'received new message :', message.mes);

    if (message.is_user)
        return;

    if (model_path === undefined) {
        console.debug(DEBUG_PREFIX, 'No model assigned to', character);
        return;
    }

    // In the new system, we let the behavior tree handle expressions and motions
    // based on the detected emotion, but we still detect the emotion for the behavior tree
    const expression = await getExpressionLabel(message.mes);
    
    // Store the detected emotion for the behavior tree to use
    if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
        window.VRM_BEHAVIOR_TREES[character].lastDetectedEmotion = expression;
        // Let the behavior tree handle this in its next regular update cycle
        // Don't trigger immediate update to avoid animation spam
    }

    // Still support the original emotion mapping as a fallback
    let model_expression = extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['expression'];
    let model_motion = extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['motion'];

    console.debug(DEBUG_PREFIX,'Detected expression in message:',expression);

    // Fallback animations
    if (model_expression == 'none') {
        console.debug(DEBUG_PREFIX,'Expression is none, applying default expression', model_expression);
        model_expression = extension_settings.vrm.model_settings[model_path]['animation_default']['expression'];
    }

    if (model_motion == 'none') {
        console.debug(DEBUG_PREFIX,'Motion is none, playing default motion',model_motion);
        model_motion = extension_settings.vrm.model_settings[model_path]['animation_default']['motion'];
    }

    // Additional safety check - ensure we have valid animation paths
    if (!model_motion || model_motion === 'none' || model_motion === 'undefined') {
        console.debug(DEBUG_PREFIX,'Default motion is invalid, using fallback neutral animation');
        model_motion = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
    }

    console.debug(DEBUG_PREFIX,'Playing expression',expression,':', model_expression, model_motion);

    // Delegate to BehaviorTree for animation control
    if (window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character]) {
        const behaviorTree = window.VRM_BEHAVIOR_TREES[character];
        await behaviorTree.setExpressionProtected(character, model_expression);
        await behaviorTree.setMotionProtected(character, model_motion);
    } else {
        // Fallback if BehaviorTree not initialized
        await setExpression(character, model_expression);
        await setMotion(character, model_motion);
    }
}


// Blink
function blink(character, modelId) {
    //console.debug(DEBUG_PREFIX,"Blink call:",character,modelId)
    if (currentAvatars[character] === undefined || currentAvatars[character]["id"] != modelId) {
        console.debug(DEBUG_PREFIX,"Stopping blink model is no more loaded:",character,modelId)
        return;
    }

    const vrm = currentAvatars[character]["vrm"];

    // Hold eyes closed
    var blinktimeout = Math.floor(Math.random() * 250) + 50;
    setTimeout(() => {
            vrm.expressionManager.setValue("blink",0);
    }, blinktimeout);
    
    // Open eyes
    vrm.expressionManager.setValue("blink",1.0);

    // Keep eyes open
    var rand = Math.round(Math.random() * 10000) + 1000;
    setTimeout(function () {
            blink(character,modelId);
    }, rand);
}

// One run for each character
// Animate mouth if talkEnd is set to a future time
// Terminated when model is unset
// Overrided by tts lip sync option
async function textTalk(character, modelId) {
    const mouth_open_speed = 1.5;
    // Model still here
    while (currentAvatars[character] !== undefined && currentAvatars[character]["id"] == modelId) {
        //console.debug(DEBUG_PREFIX,"text talk loop:",character,modelId)
        
        // Overrided by lip sync option
        if (!extension_settings.vrm.tts_lips_sync) {
            const vrm = currentAvatars[character]["vrm"]
            const talkEnd = currentAvatars[character]["talkEnd"]
            let mouth_y = 0.0;
            if (talkEnd > Date.now()) {
                mouth_y = (Math.sin((talkEnd - Date.now())) + 1) / 2;
                // Neutralize all expression in case setExpression called in parrallele
                for(const expression in vrm.expressionManager.expressionMap)
                    vrm.expressionManager.setValue(expression, Math.min(0.25, vrm.expressionManager.getValue(expression)));
                vrm.expressionManager.setValue("aa",mouth_y);
            }
            else { // Restaure expression
                vrm.expressionManager.setValue(currentAvatars[character]["expression"],1.0);
                vrm.expressionManager.setValue("aa",0.0);
            }
        }
        await delay(100 / mouth_open_speed);
    }

    console.debug(DEBUG_PREFIX,"Stopping text talk loop model is no more loaded:",character,modelId);
}

// Add text duration to currentAvatars[character]["talkEnd"]
// Overrided by tts lip sync option
async function talk(chat_id) {
    // TTS lip sync overide
    if (extension_settings.vrm.tts_lips_sync)
        return;

    // No model for user or system
    if (getContext().chat[chat_id].is_user || getContext().chat[chat_id].is_system)
        return;

    const message = getContext().chat[chat_id]
    const text = message.mes;
    const character = message.name;

    console.debug(DEBUG_PREFIX,"Playing mouth animation for",character," message:",text);

    // No model loaded for character
    if(currentAvatars[character] === undefined) {
        console.debug(DEBUG_PREFIX,"No model loaded, cannot animate talk")
        return;
    }

    currentAvatars[character]["talkEnd"] = Date.now() + text.length * 50;
}

// handle window resizes
window.addEventListener( 'resize', onWindowResize, false );

function onWindowResize(){
    if (camera !== undefined && renderer !== undefined) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
        
        // Update environment grid size
        environmentSystem.updateGridSize();
        environmentSystem.createGridHelper();
    }
}

// Update a character model to fit the saved settings
async function updateModel(character) {
    if (currentAvatars[character] !== undefined) {
        const object_container = currentAvatars[character]["objectContainer"];
        const model_path = extension_settings.vrm.character_model_mapping[character];

        object_container.scale.x = extension_settings.vrm.model_settings[model_path]['scale'];
        object_container.scale.y = extension_settings.vrm.model_settings[model_path]['scale'];
        object_container.scale.z = extension_settings.vrm.model_settings[model_path]['scale'];

        object_container.position.x = extension_settings.vrm.model_settings[model_path]['x'];
        object_container.position.y = extension_settings.vrm.model_settings[model_path]['y'];
        object_container.position.z = extension_settings.vrm.model_settings[model_path]['z']; //0.0; // In case somehow it get away from 0

        object_container.rotation.x = extension_settings.vrm.model_settings[model_path]['rx'];
        object_container.rotation.y = extension_settings.vrm.model_settings[model_path]['ry'];
        object_container.rotation.z = extension_settings.vrm.model_settings[model_path]['rz']; //0.0; // In case somehow it get away from 0

        console.debug(DEBUG_PREFIX,"Updated model:",character)
        console.debug(DEBUG_PREFIX,"Scale:",object_container.scale)
        console.debug(DEBUG_PREFIX,"Position:",object_container.position)
        console.debug(DEBUG_PREFIX,"Rotation:",object_container.rotation)
    }
}

// Update a character's position
async function updateCharacterPosition(character, x, y) {
    if (currentAvatars[character] !== undefined) {
        const object_container = currentAvatars[character]["objectContainer"];
        const model_path = extension_settings.vrm.character_model_mapping[character];
        
        // Use smooth positioning instead of grid snapping for natural movement
        const groundY = 0; // Fixed ground level
        
        // Use exact position for smooth movement (no grid snapping)
        const smoothX = x;
        const smoothZ = y; // Y parameter maps to Z in 3D space
        
        // Update the position in the settings
        extension_settings.vrm.model_settings[model_path]['x'] = smoothX;
        extension_settings.vrm.model_settings[model_path]['y'] = groundY; // Always use ground level
        extension_settings.vrm.model_settings[model_path]['z'] = smoothZ;
        
        // Update the actual model position
        object_container.position.x = smoothX;
        object_container.position.y = groundY; // Lock to ground level
        object_container.position.z = smoothZ;
        
        console.debug(DEBUG_PREFIX,`Updated ${character} position to smooth (${smoothX.toFixed(3)}, ${groundY}, ${smoothZ.toFixed(3)})`);
    }
}

// Update a character's rotation
async function updateCharacterRotation(character, rx, ry, rz) {
    if (currentAvatars[character] !== undefined) {
        const object_container = currentAvatars[character]["objectContainer"];
        const model_path = extension_settings.vrm.character_model_mapping[character];
        
        // Update the rotation in the settings
        if (rx !== undefined) extension_settings.vrm.model_settings[model_path]['rx'] = rx;
        if (ry !== undefined) extension_settings.vrm.model_settings[model_path]['ry'] = ry;
        if (rz !== undefined) extension_settings.vrm.model_settings[model_path]['rz'] = rz;
        
        // Update the actual model rotation
        if (rx !== undefined) object_container.rotation.x = rx;
        if (ry !== undefined) object_container.rotation.y = ry;
        if (rz !== undefined) object_container.rotation.z = rz;
        
        console.debug(DEBUG_PREFIX,`Updated ${character} rotation to (${rx}, ${ry}, ${rz})`);
    }
}

// Update character head rotation (for looking at things)
async function updateCharacterHeadLook(character, targetX, targetY, targetZ) {
    if (currentAvatars[character] === undefined) return;
    
    try {
        const vrm = currentAvatars[character]["vrm"];
        if (!vrm || !vrm.lookAt) return;
        
        const currentPos = getCharacterPosition(character);
        
        // Calculate look direction
        const lookDirection = new THREE.Vector3(
            targetX - currentPos.x,
            targetY - currentPos.y, 
            targetZ - (currentPos.z || 0)
        ).normalize();
        
        // Apply look direction to VRM lookAt system
        vrm.lookAt.lookAt(lookDirection);
        
        console.debug(DEBUG_PREFIX, `${character} looking at (${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)})`);
    } catch (error) {
        console.warn(DEBUG_PREFIX, `Could not make ${character} look at target:`, error);
    }
}

// Reset character head to neutral position
async function resetCharacterHeadLook(character) {
    if (currentAvatars[character] === undefined) return;
    
    try {
        const vrm = currentAvatars[character]["vrm"];
        if (!vrm || !vrm.lookAt) return;
        
        // Reset to forward direction
        vrm.lookAt.lookAt(new THREE.Vector3(0, 0, -1));
        
        console.debug(DEBUG_PREFIX, `${character} head look reset to neutral`);
    } catch (error) {
        console.warn(DEBUG_PREFIX, `Could not reset ${character} head look:`, error);
    }
}

// Make character face camera (body rotation) with smooth animation
async function faceCamera(character) {
    if (currentAvatars[character] === undefined) return;
    
    try {
        const currentPos = getCharacterPosition(character);
        const cameraPos = camera.position;
        const objectContainer = currentAvatars[character]["objectContainer"];
        
        // Calculate target angle to face camera
        const dx = cameraPos.x - currentPos.x;
        const dz = cameraPos.z - (currentPos.z || 0);
        const targetRotationY = Math.atan2(dx, dz);
        
        // Get current rotation
        const currentRotationY = objectContainer.rotation.y;
        
        // Calculate shortest rotation path
        let rotationDiff = targetRotationY - currentRotationY;
        if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
        
        // Smooth rotation over time
        const rotationSpeed = 0.15; // Rotation speed per frame
        const steps = Math.ceil(Math.abs(rotationDiff) / rotationSpeed);
        const rotationStep = rotationDiff / steps;
        
        for (let i = 0; i < steps; i++) {
            const newRotationY = currentRotationY + rotationStep * (i + 1);
            await updateCharacterRotation(character, undefined, newRotationY, undefined);
            
            // Small delay for smooth animation
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.debug(DEBUG_PREFIX, `${character} smoothly turned to face camera`);
    } catch (error) {
        console.warn(DEBUG_PREFIX, `Could not make ${character} face camera:`, error);
    }
}

// Get a character's current position
function getCharacterPosition(character) {
    if (currentAvatars[character] !== undefined) {
        const object_container = currentAvatars[character]["objectContainer"];
        return {
            x: object_container.position.x,
            y: object_container.position.y,
            z: object_container.position.z || 0
        };
    }
    return { x: 0, y: 0, z: 0 };
}

// Currently loaded character VRM accessor
function getVRM(character) {
    if (currentAvatars[character] === undefined)
        return undefined;
    return currentAvatars[character]["vrm"];
}

function clearModelCache() {
    models_cache = {};
    console.debug(DEBUG_PREFIX,"Cleared model cache");
}

function clearAnimationCache() {
    animations_cache = {};
    console.debug(DEBUG_PREFIX,"Cleared animation cache");
}

// Perform audio lip sync
// Overried text mouth movement
async function audioTalk(blob, character) {
    // Option disable
    if (!extension_settings.vrm.tts_lips_sync)
        return;
        /*return response;

    console.debug(DEBUG_PREFIX,"Received lipsync",response, character);
    let responseCopy;
    try {
        responseCopy = response.clone();
    } catch(error) {
        console.debug(DEBUG_PREFIX,"Wrong response format received abort lip sync");
        return response;
    }*/
    tts_lips_sync_job_id++;
    const job_id = tts_lips_sync_job_id;
    console.debug(DEBUG_PREFIX,"Received lipsync",blob, character,job_id);

    const audioContext = new(window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0.5;
    analyser.fftSize = 1024;

    //const blob = await responseCopy.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);

    const javascriptNode = audioContext.createScriptProcessor(256, 1, 1);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    const mouththreshold = 10;
    const mouthboost = 10;

    let lastUpdate = 0;
    const LIPS_SYNC_DELAY = 66;

    function endTalk() {
        source.stop(0);
        source.disconnect();
        analyser.disconnect();
        javascriptNode.disconnect();
        if (currentAvatars[character] !== undefined)
            currentAvatars[character]["vrm"].expressionManager.setValue("aa", 0);

        audio.removeEventListener("ended", endTalk);
        //javascriptNode.removeEventListener("onaudioprocess", onAudioProcess);
    }

    var audio = document.getElementById("tts_audio");
    function startTalk() {
        source.start(0);
        audio.removeEventListener("onplay", startTalk);
        //javascriptNode.removeEventListener("onaudioprocess", onAudioProcess);
    }
    audio.onplay = startTalk;
    audio.onended = endTalk;

    function onAudioProcess() {
        if(job_id != tts_lips_sync_job_id || audio.paused) {
            console.debug(DEBUG_PREFIX,"TTS lip sync job",job_id,"terminated")
            endTalk();
            return;
        }

        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        var values = 0;

        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += array[i];
        }

        // audio in expressed as one number
        var average = values / length;
        var inputvolume = average * (audioContext.sampleRate/48000); // Normalize the treshold

        var voweldamp = 53;
        var vowelmin = 12;
        if(lastUpdate < (Date.now() - LIPS_SYNC_DELAY)) {
            if (currentAvatars[character] !== undefined) {
                // Neutralize all expression in case setExpression called in parrallele
                for(const expression in currentAvatars[character]["vrm"].expressionManager.expressionMap)
                    currentAvatars[character]["vrm"].expressionManager.setValue(expression, Math.min(0.25, currentAvatars[character]["vrm"].expressionManager.getValue(expression)));

                if (inputvolume > (mouththreshold * 2)) {
                    const new_value = ((average - vowelmin) / voweldamp) * (mouthboost/10);
                    currentAvatars[character]["vrm"].expressionManager.setValue("aa", new_value);
                }
                else {
                    currentAvatars[character]["vrm"].expressionManager.setValue("aa", 0);
                }
            }
            lastUpdate = Date.now();
        }
    }

    javascriptNode.onaudioprocess = onAudioProcess;
    // TODO: restaure expression weight ?
}

window['vrmLipSync'] = audioTalk;

// color: any valid color format
// intensity: percent 0-100
function setLight(color,intensity) {

    light.color = new THREE.Color(color);
    light.intensity = intensity/100;
}

function setBackground(scenePath, scale, position, rotation) {

    if (background) {
        scene.remove(scene.getObjectByName(background.name));
    }

    if (scenePath.endsWith(".fbx")) {
        const fbxLoader = new FBXLoader()
        fbxLoader.load(
            scenePath,
        (object) => {
            // object.traverse(function (child) {
            //     if ((child as THREE.Mesh).isMesh) {
            //         // (child as THREE.Mesh).material = material
            //         if ((child as THREE.Mesh).material) {
            //             ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).transparent = false
            //         }
            //     }
            // })
            // object.scale.set(.01, .01, .01)
            background = object;
            background.scale.set(scale, scale, scale);
            background.position.set(position.x,position.y,position.z);
            background.rotation.set(rotation.x,rotation.y,rotation.z);
            background.name = "background";
            scene.add(background);
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
        },
        (error) => {
            console.log(error)
        }
        )
    }

    if (scenePath.endsWith(".gltf") || scenePath.endsWith(".glb")) {
        const loader = new GLTFLoader();

        loader.load( scenePath, function ( gltf ) {

            background = gltf.scene;
            background.scale.set(scale, scale, scale);
            background.position.set(position.x,position.y,position.z);
            background.rotation.set(rotation.x,rotation.y,rotation.z);
            scene.add(background);

        }, undefined, function ( error ) {

            console.error( error );

        } );
    }
}

// Load an environment asset
async function loadEnvironmentAsset(assetPath, position, scale = 1.0) {
    try {
        const assetRef = await environmentSystem.loadAsset(assetPath, position, scale);
        return assetRef;
    } catch (error) {
        console.error(DEBUG_PREFIX, `Failed to load environment asset ${assetPath}:`, error);
        return null;
    }
}

// Get the procedural animation system for a character
function getProceduralAnimationSystem(character) {
    // This function will return the procedural animation system from the global scope
    if (typeof window !== 'undefined' && window.getProceduralAnimationSystem) {
        return window.getProceduralAnimationSystem(character);
    }
    return null;
}

// Add an interactive object to the environment
function addInteractiveObject(name, position, interactionType = "inspect") {
    return environmentSystem.addInteractiveObject(name, position, interactionType);
}

// Get current animation duration for a character
function getCurrentAnimationDuration(character) {
    if (!currentAvatars[character]) {
        return 0;
    }
    
    const mixer = currentAvatars[character]["animation_mixer"];
    if (!mixer || !mixer._actions || mixer._actions.length === 0) {
        return 0;
    }
    
    // Get the currently playing action
    const activeAction = mixer._actions.find(action => action.isRunning());
    if (activeAction && activeAction._clip) {
        return activeAction._clip.duration;
    }
    
    return 0;
}

