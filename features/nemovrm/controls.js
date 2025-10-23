import * as THREE from './lib/three.module.js';
import { saveSettingsDebounced, sendMessageAsUser } from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';

import {
    DEBUG_PREFIX,
    VRM_CANVAS_ID,
    MIN_SCALE,
    MAX_SCALE,
    HIT_BOX_DELAY
} from "./constants.js";

import {
    currentAvatars,
    renderer,
    camera,
    VRM_CONTAINER_NAME,
    setExpression,
    setMotion,
    faceCamera
} from "./vrm.js";
import { func } from './lib/jsm/nodes/code/FunctionNode.js';
import { delay } from '../../../../../utils.js';

// Mouse controls
let previousMouse = undefined;
let currentMouse = undefined;
let mouseOffset = undefined;
let isDragging = false;
let isRotating = false;
let isScaling = false;
let dragCharacter = undefined;
let isMouseDown = false;

// Global mouse position tracking for character interaction
window.currentMouseX = 0;
window.currentMouseY = 0;

let previous_interaction = { 'character': '', 'message': '' };

let raycaster = new THREE.Raycaster();

function rescale(object, scaleDelta) {
    // Save mouse offset to avoid teleporting model to cursor
    //const range = camera.position.z * Math.tan( camera.fov / 360.0 * Math.PI );
    //const px = ( 2.0 * event.clientX - window.innerWidth ) / window.innerHeight * range;
    //const py = - ( 2.0 * event.clientY - window.innerHeight ) / window.innerHeight * range;
    //mouseOffset = new THREE.Vector2(px - dragCharacter.position.x, py - dragCharacter.position.y);

    object.scale.x *= scaleDelta;
    object.scale.y *= scaleDelta;
    object.scale.z *= scaleDelta;

    object.scale.x = Math.min(Math.max(object.scale.x, MIN_SCALE), MAX_SCALE)
    object.scale.y = Math.min(Math.max(object.scale.y, MIN_SCALE), MAX_SCALE)
    object.scale.z = Math.min(Math.max(object.scale.z, MIN_SCALE), MAX_SCALE)

    // TODO: restaure model offset to simulate zoom

    //console.debug(DEBUG_PREFIX,"Scale updated to",object.scale.x);
}

async function hitboxClick(character,hitbox) {
    await delay(HIT_BOX_DELAY);

    // Using control
    if (isMouseDown)
        return;

    // Was a simple click
    const model_path = extension_settings.vrm.character_model_mapping[character];
    console.debug(DEBUG_PREFIX,"Detected click on hitbox",character,hitbox,model_path,extension_settings.vrm.model_settings[model_path]['hitboxes_mapping']);

    // Make character face camera when clicked on
    await faceCamera(character);

    const model_expression = extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]["expression"];
    const model_motion = extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]["motion"];
    const message = extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]["message"];

    if (model_expression != "none") {
        setExpression(character, model_expression);
        
        // Notify behavior tree of emotion change for smooth transitions
        const behaviorTree = window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character];
        if (behaviorTree && behaviorTree.onEmotionDetected) {
            behaviorTree.onEmotionDetected(model_expression);
        }
    }

    if (model_motion != "none") {
        // Use non-forced motion to work better with procedural animations
        setMotion(character, model_motion, false, false, true, true);
        
        // Let the animation play, then return to continuous emoting
        setTimeout(() => {
            const behaviorTree = window.VRM_BEHAVIOR_TREES && window.VRM_BEHAVIOR_TREES[character];
            if (behaviorTree && behaviorTree.proceduralSystem) {
                // Restart procedural animations after click animation finishes
                const currentTime = Date.now();
                if (!behaviorTree.proceduralSystem.isAnimationActive("Blink")) {
                    behaviorTree.proceduralSystem.startAnimation("Blink", currentTime);
                }
                if (!behaviorTree.proceduralSystem.isAnimationActive("Breath")) {
                    behaviorTree.proceduralSystem.startAnimation("Breath", currentTime);
                }
                if (!behaviorTree.proceduralSystem.isAnimationActive("IdleSway")) {
                    behaviorTree.proceduralSystem.startAnimation("IdleSway", currentTime);
                }
                console.debug(DEBUG_PREFIX, `${character} procedural animations restarted after click`);
            }
        }, 2000); // Wait 2 seconds for click animation to finish
    }

    if (message != '') {
        console.debug(DEBUG_PREFIX,getContext());
        // Same interaction as last message
        if (getContext().chat[getContext().chat.length - 1].is_user && previous_interaction['character'] == character && previous_interaction['message'] == message) {
            console.debug(DEBUG_PREFIX,'Same as last interaction, nothing done');
        }
        else {
            previous_interaction['character'] = character;
            previous_interaction['message'] = message;

            //$('#send_textarea').val(''); // clear message area to avoid double message
            //sendMessageAsUser(message);
            $('#send_textarea').val(message);
            if (extension_settings.vrm.auto_send_hitbox_message) {
                await getContext().generate();
            }
        }
    }
    else
        console.debug(DEBUG_PREFIX,'Mapped message empty, nothing to send.');
}

//--------------
// Events
//-------------

document.addEventListener("pointermove", async (event) => {pointerMove(event);});
document.addEventListener("pointerdown", (event) => {pointerDown(event);});
document.addEventListener("wheel", async (event) => {wheel(event);});

// Also track mouse movement for character interaction even outside canvas
document.addEventListener("mousemove", (event) => {
    window.currentMouseX = event.clientX;
    window.currentMouseY = event.clientY;
});
document.addEventListener("pointerup", () => {// Drop object
    isDragging = false;
    isRotating = false;
    isScaling = false;
    dragCharacter = undefined;

    isMouseDown = false;
    //console.debug(DEBUG_PREFIX,"Ponter released");
} );

// Select model for drag/rotate
async function pointerDown(event) {
    isMouseDown = true;
    if (raycaster !== undefined && currentMouse !== undefined && camera !== undefined) {
        // UI between mouse and canvas
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (element.id != VRM_CANVAS_ID)
            return;

        const mouseX = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
        const mouseY = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
        const pointer = new THREE.Vector2(mouseX,mouseY);

        raycaster.setFromCamera(pointer, camera);
        
        // Check for character 
        for(const character in currentAvatars) {

            const hitboxes = []

            for(const hit_part in currentAvatars[character]["hitboxes"])
                hitboxes.push(currentAvatars[character]["hitboxes"][hit_part]["collider"])
            
            let insersects = raycaster.intersectObjects(hitboxes, false);

            if(insersects.length > 0) {
                const hitbox = insersects[0].object;
                hitboxClick(character,hitbox.name);
            }

            insersects = raycaster.intersectObject(currentAvatars[character]["collider"], false);
            
            if(insersects.length > 0) {
                dragCharacter = character;
                break;
            }

        }

        // Mouse controls disabled
        if (extension_settings.vrm.lock_models)
            return;

        if (dragCharacter === undefined)
            return;

        const isLeftClick = event.pointerType === 'mouse' && event.button === 0;
        const isMiddleClick = event.pointerType === 'mouse' && event.button === 1;

        // Move
        if(isLeftClick && !event.ctrlKey && !event.shiftKey){
            // Save mouse offset to avoid teleporting model to cursor
            const range = camera.position.z * Math.tan( camera.fov / 360.0 * Math.PI );
            const px = ( 2.0 * event.clientX - window.innerWidth ) / window.innerHeight * range;
            const py = - ( 2.0 * event.clientY - window.innerHeight ) / window.innerHeight * range;
            mouseOffset = new THREE.Vector2(px - currentAvatars[dragCharacter]["objectContainer"].position.x, py - currentAvatars[dragCharacter]["objectContainer"].position.y);

            isDragging = true;
            isRotating = false;
            isScaling = false;
        }

        // Rotation
        if(isMiddleClick || (isLeftClick && event.ctrlKey && !event.shiftKey)){ 
            isDragging = false;
            isRotating = true;
            isScaling = false;
        }

        // Scale
        if(isLeftClick && event.shiftKey && !event.ctrlKey){
            isScaling = true;
        }
    }
}

async function pointerMove(event) {
    // Update global mouse position for character interaction
    window.currentMouseX = event.clientX;
    window.currentMouseY = event.clientY;
    
    // init
    if (previousMouse === undefined || currentMouse === undefined) {
        previousMouse = new THREE.Vector2();
        currentMouse = new THREE.Vector2();
    }
    
    // Mouse controls disabled
    if (extension_settings.vrm.lock_models)
        return;

    if (raycaster !== undefined && camera !== undefined) {
        const character = dragCharacter;

        // Draggin model
        if (isDragging) {
            const range = (camera.position.z - currentAvatars[character]["objectContainer"].position.z) * Math.tan( camera.fov / 360.0 * Math.PI );
            const px = ( 2.0 * event.clientX - window.innerWidth ) / window.innerHeight * range;
            const py = - ( 2.0 * event.clientY - window.innerHeight ) / window.innerHeight * range;
            const model_path = extension_settings.vrm.character_model_mapping[character];
            currentAvatars[character]["objectContainer"].position.set( px-mouseOffset.x, py-mouseOffset.y, currentAvatars[character]["objectContainer"].position.z );

            extension_settings.vrm.model_settings[model_path]['x'] = (currentAvatars[character]["objectContainer"].position.x).toFixed(2);
            extension_settings.vrm.model_settings[model_path]['y'] = (currentAvatars[character]["objectContainer"].position.y).toFixed(2);
            $('#vrm_model_position_x').val(extension_settings.vrm.model_settings[model_path]['x']);
            $('#vrm_model_position_x_value').text(extension_settings.vrm.model_settings[model_path]['x']);
            $('#vrm_model_position_y').val(extension_settings.vrm.model_settings[model_path]['y']);
            $('#vrm_model_position_y_value').text(extension_settings.vrm.model_settings[model_path]['y']);
            saveSettingsDebounced();
        }

        // Rotating model
        if (isRotating) {
            const xDelta = (previousMouse.x - (event.clientX / window.innerWidth)) * 10;
            const yDelta = (previousMouse.y - (event.clientY / window.innerHeight)) * 10;
            const model_path = extension_settings.vrm.character_model_mapping[character];
            // Apply rotations: yDelta affects X-axis (pitch/tilt toward/away from camera), xDelta affects Y-axis (yaw/turn left/right)
            currentAvatars[character]["objectContainer"].rotation.set(
                currentAvatars[character]["objectContainer"].rotation.x + yDelta, // X-axis rotation (pitch)
                currentAvatars[character]["objectContainer"].rotation.y - xDelta, // Y-axis rotation (yaw)
                0.0
            );

            extension_settings.vrm.model_settings[model_path]['rx'] = (currentAvatars[character]["objectContainer"].rotation.x).toFixed(2);
            extension_settings.vrm.model_settings[model_path]['ry'] = (currentAvatars[character]["objectContainer"].rotation.y).toFixed(2);
            $('#vrm_model_rotation_x').val(extension_settings.vrm.model_settings[model_path]['rx']);
            $('#vrm_model_rotation_x_value').text(extension_settings.vrm.model_settings[model_path]['rx']);
            $('#vrm_model_rotation_y').val(extension_settings.vrm.model_settings[model_path]['ry']);
            $('#vrm_model_rotation_y_value').text(extension_settings.vrm.model_settings[model_path]['ry']);
            saveSettingsDebounced();
        }

        // Scaling
        if (isScaling) {
            const yDelta = (previousMouse.y - (event.clientY / window.innerHeight)) * 10;
            
            //console.debug(DEBUG_PREFIX,"SCALING delta",yDelta)
            let scaleDelta = 1.05;
            if (yDelta < 0)
                scaleDelta = 0.95;

            rescale(currentAvatars[character]["objectContainer"], scaleDelta);
            rescale(currentAvatars[character]["collider"], scaleDelta);
            
            // Update saved settings
            const model_path = extension_settings.vrm.character_model_mapping[character];
            extension_settings.vrm.model_settings[model_path]['scale'] = (currentAvatars[character]["objectContainer"].scale.x).toFixed(2);
            $('#vrm_model_scale').val(extension_settings.vrm.model_settings[model_path]['scale']);
            $('#vrm_model_scale_value').text(extension_settings.vrm.model_settings[model_path]['scale']);
            saveSettingsDebounced();
        }

        // Save mouse position
        previousMouse.x = (event.clientX / window.innerWidth);
        previousMouse.y = (event.clientY / window.innerHeight);
    }
}

async function wheel(event) {
    // Mouse controls disabled
    if (extension_settings.vrm.lock_models)
        return;

    //No change
    if(event.deltaY == 0)
        return;

    // UI between mouse and canvas
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (element != null && element.id != VRM_CANVAS_ID)
        return;

    const mouseX = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    const mouseY = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    const pointer = new THREE.Vector2(mouseX,mouseY);

    raycaster.setFromCamera(pointer, camera);

    // Check for character 
    for(const character in currentAvatars) {
        const insersects = raycaster.intersectObject(currentAvatars[character]["collider"], false);
            
        if(insersects.length > 0) {
            // Restrict scale
            let scaleDelta = 1.1;
            if (event.deltaY > 0)
                scaleDelta = 0.9;

            rescale(currentAvatars[character]["objectContainer"], scaleDelta);
            rescale(currentAvatars[character]["collider"], scaleDelta);
            
            // Update saved settings
            const model_path = extension_settings.vrm.character_model_mapping[character];
            extension_settings.vrm.model_settings[model_path]['scale'] = (currentAvatars[character]["objectContainer"].scale.x).toFixed(2);
            $('#vrm_model_scale').val(extension_settings.vrm.model_settings[model_path]['scale']);
            $('#vrm_model_scale_value').text(extension_settings.vrm.model_settings[model_path]['scale']);
            saveSettingsDebounced();
            break;
        }
    }
}
