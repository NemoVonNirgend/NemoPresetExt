import { getContext } from "../../../../../extensions.js";
import { CLASSIFY_EXPRESSIONS, ANIMATION_GROUPS, DEBUG_PREFIX, VRM_CANVAS_ID } from "./constants.js";
import { setExpression, setMotion, playAnimationSequence, getCurrentAnimationDuration, getAnimationFileDuration, updateCharacterPosition, updateCharacterRotation, updateCharacterHeadLook, resetCharacterHeadLook, faceCamera, getCharacterPosition, getProceduralAnimationSystem, getVRM } from "./vrm.js";
import { environmentSystem } from "./environment.js";
import * as THREE from './lib/three.module.js';

export class BehaviorTree {
    constructor(character) {
        this.character = character;
        this.currentState = "idle";
        this.lastBehaviorTime = Date.now();
        this.lastDetectedEmotion = "neutral";
        
        // Hook into emotion detection to update our state system
        this.onEmotionDetected = this.onEmotionDetected.bind(this);
        this.lastUserMessageTime = Date.now();
        this.idleTimeout = 10000; // 10 seconds
        this.behaviorHistory = [];
        this.maxHistoryLength = 5;
        this.useLLM = false; // Flag to enable LLM integration
        this.llmAPIKey = ""; // API key for LLM
        this.userPresent = true; // Track user presence
        this.userPresenceTimeout = 30000; // 30 seconds
        this.nextBehaviorRequestTime = 0; // When to request next behavior
        this.pendingBehavior = null; // Behavior waiting to be executed
        this.currentPosition = { x: 0, y: 0 }; // Character's current position
        this.targetPosition = { x: 0, y: 0 }; // Character's target position
        this.isMoving = false; // Is character currently moving
        this.movementSpeed = 0.015; // Base movement speed per update (smoother, more natural)
        this.lastRotationUpdate = 0; // Track last rotation update time
        this.rotationUpdateInterval = 16; // Update rotation every frame (~60fps) for smoother turning
        this.minimumWalkDistance = 1.0; // Minimum distance to trigger walking animation (lowered)
        this.gridSize = 0.1; // Smaller grid spacing for smoother movement
        this.behaviorCache = new Map(); // Cache for AI responses
        this.cacheTimeout = 300000; // 5 minutes cache timeout
        
        // Enhanced movement system variables
        this.velocity = { x: 0, y: 0 }; // Current velocity vector
        this.maxSpeed = 0.065; // Maximum movement speed (increased for more natural walk pace)
        this.acceleration = 0.008; // Smoother acceleration for more natural movement
        this.deceleration = 0.015; // Faster deceleration for more responsive stopping
        this.rotationSpeed = 0.25; // Rotation interpolation speed (increased for more responsive turning)
        this.targetRotation = 0; // Target Y rotation
        this.currentRotation = 0; // Current Y rotation for smooth interpolation
        this.isWalking = false; // Track if currently playing walk animation
        this.walkAnimationSyncThreshold = 0.008; // Speed threshold for walk animation (lowered for speed-synced playback)
        this.lastAnimationPosition = null; // Track position before animation
        this.lastSpeedAdjustment = 0; // Track last speed adjustment time
        this.speedAdjustmentInterval = 100; // Adjust speed every 100ms

        // World bounds awareness to avoid walking into screen edges
        // Scene space is roughly X/Z in [-2.0, 2.0] based on environment description
        this.worldBounds = { minX: -2.0, maxX: 2.0, minY: -2.0, maxY: 2.0 };
        this.boundaryMargin = 0.25; // keep some margin from edges to avoid walking in place at borders
        
        // Emotion and procedural animation management
        this.currentEmotionState = "neutral";
        this.targetEmotionState = "neutral";
        this.emotionTransitionStartTime = 0;
        this.emotionTransitionDuration = 2000; // 2 seconds
        this.lastEmotionChangeTime = 0;
        this.minimumEmotionDuration = 3000; // Minimum time between emotion changes
        this.proceduralSystem = null;
        
        // Animation management
        this.currentAnimationStartTime = 0;
// Anti-repeat cooldowns and recent tracking
this.recentThemes = new Map(); // theme -> lastTimestamp
this.themeCooldowns = {
    walk: 8000,
    move: 8000,
    idle: 4000,
    activity: 5000,
    dance_party: 12000,
    rhythmic_movement: 9000,
    workout_time: 12000,
    reading_contemplation: 12000,
    stretching_routine: 9000,
    greeting_practice: 6000,
    observation_and_thinking: 7000,
    creative_activities: 9000,
    environment_interaction: 9000,
    thorough_exploration: 10000,
    emotional_expression: 7000
};

// Behavior-type cooldowns to prevent loops on same type
this.lastBehaviorByType = new Map(); // type -> lastTimestamp
this.behaviorTypeCooldowns = {
    motion: 2500,
    move: 6000,
    sequence: 4000,
    procedural: 1500,
    interaction_point: 6000,
    face_user: 2500,
    expression: 2000,
};

// Animation anti-repeat by path
this.recentAnimationPaths = new Map(); // path -> lastTimestamp
this.animationCooldownMs = 7000;
        this.currentAnimationPath = null;
        this.minimumAnimationDuration = 300; // Further reduced for more responsive transitions
        this.animationQueue = []; // Queue for pending animations
        this.isProcessingQueue = false; // Flag to prevent re-entry
        
        // Mouse tracking
        this.mouseWorldPosition = { x: 0, y: 0 }; // Mouse position in world coordinates
        this.isMouseNearby = false; // Is mouse close enough to interact
        this.mouseNearbyDistance = 2.0; // Distance threshold for mouse interaction
        this.lastMouseLookTime = 0; // Track mouse look timing
        this.mouseLookInterval = 200; // Update mouse look every 200ms
        this.isLookingAtMouse = false; // Currently looking at mouse
        
        // Enhanced environment interaction points with more variety
        this.interactionPoints = [
            { x: 0, y: 0, name: "center", behavior: "look_around", description: "Central observation point" },
            { x: -1.2, y: -1.2, name: "quiet_corner", behavior: "contemplative", description: "Peaceful corner for reflection" },
            { x: 1.2, y: -1.2, name: "social_corner", behavior: "friendly_wave", description: "Social interaction area" },
            { x: -1.2, y: 1.2, name: "creative_space", behavior: "creative_pose", description: "Area for creative activities" },
            { x: 1.2, y: 1.2, name: "observation_deck", behavior: "curious_look", description: "High vantage point" },
            { x: 0, y: -1.5, name: "entrance", behavior: "welcoming_gesture", description: "Entry/welcome area" },
            { x: 0, y: 1.5, name: "stage_area", behavior: "performance_pose", description: "Performance or presentation area" },
            { x: -1.5, y: 0, name: "thinking_spot", behavior: "thoughtful_pause", description: "Deep thinking location" },
            { x: 1.5, y: 0, name: "activity_zone", behavior: "energetic_movement", description: "Active engagement area" }
        ];
        
        // Dynamic interaction point behaviors
        this.interactionBehaviors = {
            "look_around": {
                actions: [
                    { type: "procedural", value: "look_around", duration: 4.0 },
                    { type: "expression", value: "surprised" }
                ]
            },
            "contemplative": {
                actions: [
                    { type: "expression", value: "neutral" },
                    { type: "procedural", value: "nod", intensity: 0.2, count: 3 },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh", loop: false }
                ]
            },
            "friendly_wave": {
                actions: [
                    { type: "expression", value: "happy" },
                    { type: "procedural", value: "wave", intensity: 0.8 },
                    { type: "face_user", value: true }
                ]
            },
            "creative_pose": {
                actions: [
                    { type: "expression", value: "surprised" },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/joy.bvh", loop: false },
                    { type: "procedural", value: "stretch", duration: 2.0 }
                ]
            },
            "curious_look": {
                actions: [
                    { type: "expression", value: "surprised" },
                    { type: "procedural", value: "look_around", duration: 5.0 },
                    { type: "procedural", value: "nod", intensity: 0.3, count: 1 }
                ]
            },
            "welcoming_gesture": {
                actions: [
                    { type: "face_user", value: true },
                    { type: "expression", value: "happy" },
                    { type: "procedural", value: "wave", intensity: 0.6 },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/joy.bvh", loop: false }
                ]
            },
            "performance_pose": {
                actions: [
                    { type: "expression", value: "happy" },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_1.bvh", loop: false },
                    { type: "face_user", value: true }
                ]
            },
            "thoughtful_pause": {
                actions: [
                    { type: "expression", value: "neutral" },
                    { type: "procedural", value: "sigh" },
                    { type: "procedural", value: "look_around", duration: 3.0 },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle2.bvh", loop: false }
                ]
            },
            "energetic_movement": {
                actions: [
                    { type: "expression", value: "happy" },
                    { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/joy.bvh", loop: false },
                    { type: "procedural", value: "stretch", duration: 1.5 },
                    { type: "move", value: { x: Math.random() * 1 - 0.5, y: Math.random() * 1 - 0.5 } }
                ]
            }
        };
        
        // Initialize character position and snap to grid
        const position = getCharacterPosition(character);
        const gridPosition = this.snapToGrid(position.x, position.y);
        this.currentPosition = { x: gridPosition.x, y: gridPosition.y };
        this.targetPosition = { x: gridPosition.x, y: gridPosition.y };
        
        // Initialize environment system
        this.initializeEnvironment();
        
        // Initialize procedural animation system
        this.initializeProceduralSystem();
    }
    
    // Initialize environment system
    async initializeEnvironment() {
        try {
            await environmentSystem.initialize();
            console.debug(DEBUG_PREFIX, `Environment system initialized for ${this.character}`);
        } catch (error) {
            console.error(DEBUG_PREFIX, `Failed to initialize environment system for ${this.character}:`, error);
        }
    }

    // Main method to update character behavior
    async update() {
        const currentTime = Date.now();
        
        // Safety check: ensure character hasn't disappeared
        await this.ensureCharacterVisible();
        
        // Handle character movement
        if (this.isMoving) {
            await this.updateMovement();
        }
        
        // Update mouse tracking
        await this.updateMouseTracking(currentTime);
        
        // Check user presence
        this.checkUserPresence(currentTime);
        
        // Request next behavior if needed
        if (currentTime >= this.nextBehaviorRequestTime) {
            await this.requestNextBehavior();
        }
        
        // Execute pending behavior if it's time
        if (this.pendingBehavior && currentTime >= this.pendingBehavior.executeTime) {
            await this.executeBehavior(this.pendingBehavior.behavior);
            this.pendingBehavior = null;
        }
        
        // Don't execute new behaviors while moving
        if (this.isMoving) {
            return; // Skip behavior execution while character is moving
        }
        
        // Only execute new behaviors at appropriate intervals
        const minBehaviorInterval = 3000; // 3 seconds minimum between behaviors (reduced for more activity)
        if (currentTime - this.lastBehaviorTime < minBehaviorInterval) {
            return; // Skip behavior execution if too soon
// Theme cooldown enforcement to prevent repeating same behavior theme
try {
    if (!this.recentThemes) this.recentThemes = new Map();
    if (!this.themeCooldowns) {
        this.themeCooldowns = {
            walk: 8000, move: 8000, idle: 4000, activity: 5000,
            dance_party: 12000, rhythmic_movement: 9000, workout_time: 12000,
            reading_contemplation: 12000, stretching_routine: 9000, greeting_practice: 6000,
            observation_and_thinking: 7000, creative_activities: 9000,
            environment_interaction: 9000, thorough_exploration: 10000, emotional_expression: 7000
        };
    }
    const theme = behavior.theme;
    if (theme) {
        const last = this.recentThemes.get(theme) || 0;
        const cd = this.themeCooldowns[theme] ?? 0;
        if (cd > 0 && (currentTime - last) < cd) {
            console.debug(DEBUG_PREFIX, `${this.character} skipping theme '${theme}' due to cooldown (${currentTime - last}ms < ${cd}ms)`);
            return; // skip execution this update to avoid loops
        }
        // Record usage timestamp before execution to reduce rapid re-selection
        this.recentThemes.set(theme, currentTime);
    }
} catch (e) {
    // ignore cooldown errors
}
        }
        
        // Get current emotional state
        const emotion = this.lastDetectedEmotion || await this.getCurrentEmotion();
        
        // Decide on next behavior based on state and context
        let behavior;
        
        // Use LLM if enabled
        if (this.useLLM) {
            behavior = await this.getLLMBehavior(getContext(), emotion);
        }
        
        // Fallback to rule-based behaviors if LLM is disabled or fails
        if (!behavior) {
            if (this.currentState === "idle" && currentTime - this.lastBehaviorTime > this.idleTimeout) {
                behavior = await this.getIdleBehavior(emotion);
                console.debug(DEBUG_PREFIX, 'Generated idle behavior for', this.character, ':', behavior);
            } else if (emotion !== "neutral") {
                behavior = await this.getEmotionBehavior(emotion);
                console.debug(DEBUG_PREFIX, 'Generated emotion behavior for', this.character, ':', behavior);
            } else {
                // Don't constantly execute default behavior
                return;
            }
        } else {
            console.debug(DEBUG_PREFIX, 'Using LLM-generated behavior for', this.character, ':', behavior);
        }
        
        // Skip if no behavior to execute
        if (!behavior) {
            return;
        }
        
        // Final validation of behavior before execution
        if (!behavior || !behavior.type) {
            console.warn(DEBUG_PREFIX, 'Invalid behavior generated, using fallback for', this.character);
            behavior = { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh", loop: true };
        }
        
        // Execute the behavior
        await this.executeBehavior(behavior);
        
        // Update last behavior time
        this.lastBehaviorTime = currentTime;
        
        // Update history
        this.updateBehaviorHistory(behavior);

        // Process any queued animations after a behavior execution
        this.processAnimationQueue();
    }
    
    // Update character movement with smooth vector-based system
    async updateMovement() {
        const currentTime = Date.now();
        
        // Handle pathfinding movement
        if (this.path && this.currentPathIndex < this.path.length) {
            const target = this.path[this.currentPathIndex];
            const dx = target.x - this.currentPosition.x;
            const dy = target.z - this.currentPosition.y; // z in 3D is y in 2D
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If we're close enough to this path point, move to the next one
            if (distance < 0.03) {
                this.currentPathIndex++;
                if (this.currentPathIndex >= this.path.length) {
                    // Reached end of path - smooth stop
                    console.debug(DEBUG_PREFIX, `${this.character} reached end of path. Stopping.`);
                    await this.smoothStop();
                    return;
                }
                console.debug(DEBUG_PREFIX, `${this.character} moving to next path point: ${this.currentPathIndex}/${this.path.length}`);
                return; // Move to next update
            }
            
            // Calculate desired velocity direction
            const directionX = dx / distance;
            const directionY = dy / distance;
            
            // Update movement with smooth acceleration/deceleration
            await this.updateSmoothMovement(directionX, directionY, distance, target.x, target.z);
            return;
        }
        
        // Handle direct movement
        const dx = this.targetPosition.x - this.currentPosition.x;
        const dy = this.targetPosition.y - this.currentPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If we're close enough to the target, smooth stop
        if (distance < 0.03) {
            console.debug(DEBUG_PREFIX, `${this.character} reached direct target. Stopping.`);
            await this.smoothStop();
            return;
        }
        
        // Calculate desired velocity direction
        const directionX = dx / distance;
        const directionY = dy / distance;
        
        // Update movement with smooth acceleration/deceleration
        await this.updateSmoothMovement(directionX, directionY, distance, this.targetPosition.x, this.targetPosition.y);
    }
    
    // Smooth movement update with proper velocity handling
    async updateSmoothMovement(directionX, directionY, distanceToTarget, targetX, targetY) {
        const currentTime = Date.now();
        
        // Calculate target speed based on distance (slow down when approaching target)
        const slowDownDistance = 0.5;
        let targetSpeed = this.maxSpeed;
        if (distanceToTarget < slowDownDistance) {
            targetSpeed = this.maxSpeed * (distanceToTarget / slowDownDistance);
            targetSpeed = Math.max(targetSpeed, this.maxSpeed * 0.1); // Minimum speed
        }
        
        // Calculate desired velocity
        let desiredVelX = directionX * targetSpeed;
        let desiredVelY = directionY * targetSpeed;

        // Boundary awareness: if near an edge and heading further out, damp outward component
        const leftEdge   = this.currentPosition.x <= (this.worldBounds.minX + this.boundaryMargin);
        const rightEdge  = this.currentPosition.x >= (this.worldBounds.maxX - this.boundaryMargin);
        const bottomEdge = this.currentPosition.y <= (this.worldBounds.minY + this.boundaryMargin);
        const topEdge    = this.currentPosition.y >= (this.worldBounds.maxY - this.boundaryMargin);

        // Check if we're being blocked by boundaries
        let boundaryBlocked = false;

        // If near left edge and moving left, zero X outward velocity
        if (leftEdge && desiredVelX < 0) {
            desiredVelX = 0;
            boundaryBlocked = true;
        }
        // If near right edge and moving right, zero X outward velocity
        if (rightEdge && desiredVelX > 0) {
            desiredVelX = 0;
            boundaryBlocked = true;
        }
        // If near bottom edge and moving down, zero Y outward velocity
        if (bottomEdge && desiredVelY < 0) {
            desiredVelY = 0;
            boundaryBlocked = true;
        }
        // If near top edge and moving up, zero Y outward velocity
        if (topEdge && desiredVelY > 0) {
            desiredVelY = 0;
            boundaryBlocked = true;
        }

        // If movement is completely blocked by boundaries, try to turn away or stop
        if (boundaryBlocked && Math.abs(desiredVelX) < 0.001 && Math.abs(desiredVelY) < 0.001) {
            console.debug(DEBUG_PREFIX, `${this.character} hit boundary, trying to turn away`);
            
            // Try to turn character away from the boundary
            let turnDirection = 0;
            if (leftEdge) turnDirection = Math.PI / 2; // Turn right
            else if (rightEdge) turnDirection = -Math.PI / 2; // Turn left  
            else if (bottomEdge) turnDirection = Math.PI; // Turn around
            else if (topEdge) turnDirection = 0; // Turn forward
            
            // Apply the turn and try to find a new direction
            if (turnDirection !== 0) {
                this.targetRotation = this.currentRotation + turnDirection;
                // Use normalized direction vector for rotation
                await this.updateSmoothRotation(Math.sin(turnDirection), Math.cos(turnDirection));
                
                // Set a new target position away from boundary
                const avoidanceDistance = 0.3; // Reduced distance to be safer
                const newTargetX = this.currentPosition.x + Math.sin(turnDirection) * avoidanceDistance;
                const newTargetY = this.currentPosition.y + Math.cos(turnDirection) * avoidanceDistance;
                
                // Only set new target if it's within bounds
                if (newTargetX > this.worldBounds.minX + this.boundaryMargin && 
                    newTargetX < this.worldBounds.maxX - this.boundaryMargin &&
                    newTargetY > this.worldBounds.minY + this.boundaryMargin && 
                    newTargetY < this.worldBounds.maxY - this.boundaryMargin) {
                    this.targetPosition = { x: newTargetX, y: newTargetY };
                    console.debug(DEBUG_PREFIX, `${this.character} turned away from boundary, new target: (${newTargetX.toFixed(2)}, ${newTargetY.toFixed(2)})`);
                    return; // Continue movement with new target
                }
            }
            
            // If we can't turn away, stop completely
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isMoving = false;
            this.path = null;
            this.targetPosition = null;
            
            // Force stop walking animation immediately
            if (this.isWalking) {
                const idleAnimation = this.getRandomAnimation("idle");
                await this.setMotionProtected(this.character, idleAnimation, true, true);
                this.isWalking = false;
                console.debug(DEBUG_PREFIX, `${this.character} stopped walking due to boundary collision`);
            }
            return; // Exit early to prevent further movement processing
        }

        // If we zeroed an outward component and both are zero (dead end), gently steer back toward center
        if (desiredVelX === 0 && desiredVelY === 0 && (leftEdge || rightEdge || bottomEdge || topEdge)) {
            const steerToCenterX = Math.sign(0 - this.currentPosition.x) * this.maxSpeed * 0.5;
            const steerToCenterY = Math.sign(0 - this.currentPosition.y) * this.maxSpeed * 0.5;
            desiredVelX = steerToCenterX;
            desiredVelY = steerToCenterY;
        }
        
        // Smoothly interpolate towards desired velocity with improved dynamics
        const velDiffX = desiredVelX - this.velocity.x;
        const velDiffY = desiredVelY - this.velocity.y;
        
        // Use acceleration or deceleration based on whether we're speeding up or slowing down
        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        const desiredSpeed = Math.sqrt(desiredVelX * desiredVelX + desiredVelY * desiredVelY);
        
        // More sophisticated acceleration logic
        let accelRate;
        if (desiredSpeed < currentSpeed * 0.5) {
            // Significant slowdown - use deceleration
            accelRate = this.deceleration;
        } else if (desiredSpeed > currentSpeed * 1.2) {
            // Significant speedup - use acceleration
            accelRate = this.acceleration;
        } else {
            // Minor adjustment - use average for smoothness
            accelRate = (this.acceleration + this.deceleration) * 0.5;
        }
        
        this.velocity.x += velDiffX * accelRate;
        this.velocity.y += velDiffY * accelRate;
        
        // Smooth rotation towards movement direction FIRST (before position clamp)
        // This allows character to start turning before hitting boundaries
        if (currentSpeed > 0.005 && (currentTime - this.lastRotationUpdate > this.rotationUpdateInterval)) {
            await this.updateSmoothRotation(directionX, directionY);
            this.lastRotationUpdate = currentTime;
        }

        // Apply velocity to position
        this.currentPosition.x += this.velocity.x;
        this.currentPosition.y += this.velocity.y;

        // Hard clamp to bounds to guarantee we never walk off-screen
        this.currentPosition.x = Math.max(this.worldBounds.minX + this.boundaryMargin, Math.min(this.worldBounds.maxX - this.boundaryMargin, this.currentPosition.x));
        this.currentPosition.y = Math.max(this.worldBounds.minY + this.boundaryMargin, Math.min(this.worldBounds.maxY - this.boundaryMargin, this.currentPosition.y));
        
        // Sync walking animation (more responsive)
        await this.syncWalkingAnimation();
        
        // Safety check: ensure position is valid before updating
        if (isNaN(this.currentPosition.x) || isNaN(this.currentPosition.y) ||
            !isFinite(this.currentPosition.x) || !isFinite(this.currentPosition.y)) {
            console.error(DEBUG_PREFIX, `${this.character} invalid position detected! Resetting to center.`);
            this.currentPosition = { x: 0, y: 0 };
            this.velocity = { x: 0, y: 0 };
            this.isMoving = false;
        }

        // Update character position in the world
        await updateCharacterPosition(this.character, this.currentPosition.x, this.currentPosition.y);
        console.debug(DEBUG_PREFIX, `${this.character} moving to (${this.currentPosition.x.toFixed(2)}, ${this.currentPosition.y.toFixed(2)}) with speed ${currentSpeed.toFixed(4)}`);
    }
    
    // Smooth stop with deceleration
    async smoothStop() {
        // Gradually reduce velocity to zero
        const decelFactor = 0.85; // How quickly we decelerate
        this.velocity.x *= decelFactor;
        this.velocity.y *= decelFactor;
        
        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        
        if (currentSpeed < 0.001) {
            // Fully stopped
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isMoving = false;
            this.path = null;
            
            // Transition to idle animation
            if (this.isWalking) {
                const idleAnimation = this.getRandomAnimation("idle");
                await this.setMotionProtected(this.character, idleAnimation, true); // Use protected setMotion - getRandomAnimation now always returns valid path
                this.isWalking = false;
                console.debug(DEBUG_PREFIX, `${this.character} transitioned to idle after stopping.`);
            }
        } else {
            // Continue deceleration
            this.currentPosition.x += this.velocity.x;
            this.currentPosition.y += this.velocity.y;
            await updateCharacterPosition(this.character, this.currentPosition.x, this.currentPosition.y);
            await this.syncWalkingAnimation();
            console.debug(DEBUG_PREFIX, `${this.character} decelerating, current speed: ${currentSpeed.toFixed(4)}`);
        }
    }
    
    // Sync walking animation with actual movement speed
    async syncWalkingAnimation() {
        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        
        // Improved walking trigger logic based on actual movement speed
        const hasSignificantSpeed = currentSpeed > this.walkAnimationSyncThreshold;
        const hasMovementTarget = this.isMoving && (this.path || this.targetPosition);
        const targetDistance = this.targetPosition ?
            Math.sqrt((this.targetPosition.x - this.currentPosition.x) ** 2 + (this.targetPosition.y - this.currentPosition.y) ** 2) : 0;
        
        // Check if we're at a boundary and movement is blocked
        const atBoundary = (
            this.currentPosition.x <= (this.worldBounds.minX + this.boundaryMargin) ||
            this.currentPosition.x >= (this.worldBounds.maxX - this.boundaryMargin) ||
            this.currentPosition.y <= (this.worldBounds.minY + this.boundaryMargin) ||
            this.currentPosition.y >= (this.worldBounds.maxY - this.boundaryMargin)
        );
        
        // Only walk if we have significant speed AND movement target AND not stuck at boundary
        const shouldWalk = hasSignificantSpeed && hasMovementTarget && (targetDistance > 0.05) && 
                          !(atBoundary && currentSpeed < this.walkAnimationSyncThreshold);
        
        // Debug logging for animation sync (only when actually moving)
        if (this.isMoving && currentSpeed > 0.001) {
            console.debug(DEBUG_PREFIX, `${this.character} sync check - speed: ${currentSpeed.toFixed(6)}, threshold: ${this.walkAnimationSyncThreshold}, distance: ${targetDistance.toFixed(3)}, shouldWalk: ${shouldWalk}, isWalking: ${this.isWalking}`);
        }

        if (shouldWalk && !this.isWalking) {
            // Store position before starting walking animation
            this.lastAnimationPosition = await getCharacterPosition(this.character);
            
            // Start walking animation with fallback logic
            const walkStyle = this.getWalkStyle();
            let walkAnimation = this.getRandomAnimation("walk", walkStyle);
            
            // Fallback to neutral walk if style-specific walk fails
            if (!walkAnimation && walkStyle !== "neutral") {
                console.warn(DEBUG_PREFIX, `${this.character} ${walkStyle} walk animation not found, trying neutral`);
                walkAnimation = this.getRandomAnimation("walk", "neutral");
            }
            
            console.debug(DEBUG_PREFIX, `${this.character} starting walk animation: ${walkAnimation}`);
            const changed = await this.setMotionProtected(this.character, walkAnimation, true, true, false, false); // Force=true to override minimum duration for walking
            if (changed) {
                this.isWalking = true;
                
                // Adjust animation speed based on movement velocity and add variation
                await this.adjustAnimationSpeed(currentSpeed);
                
                console.debug(DEBUG_PREFIX, `${this.character} started walking (${walkStyle}) with: ${walkAnimation} - speed: ${currentSpeed.toFixed(4)}`);
            } else {
                console.error(DEBUG_PREFIX, `${this.character} failed to start walking animation: ${walkAnimation}`);
            }
        } else if (!shouldWalk && this.isWalking) {
            // Stop walking animation - be more responsive to stopping
            const idleAnimation = this.getRandomAnimation("idle");
            console.debug(DEBUG_PREFIX, `${this.character} stopping walk, switching to idle: ${idleAnimation} (atBoundary: ${atBoundary}, speed: ${currentSpeed.toFixed(4)})`);
            const changed = await this.setMotionProtected(this.character, idleAnimation, true, true); // Force idle transition
            if (changed) {
                this.isWalking = false;
                
                // Add subtle variation to idle animation
                await this.addAnimationVariation();
                
                console.debug(DEBUG_PREFIX, `${this.character} stopped walking - speed: ${currentSpeed.toFixed(4)}`);
                
                // If we stopped due to boundary collision, also stop movement
                if (atBoundary && currentSpeed < 0.001) {
                    this.isMoving = false;
                    this.path = null;
                    this.targetPosition = null;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    console.debug(DEBUG_PREFIX, `${this.character} fully stopped due to boundary collision`);
                }
            }
        } else if (shouldWalk && this.isWalking) {
            // Continuously adjust walking speed while walking (throttled for performance)
            const currentTime = Date.now();
            if (currentTime - this.lastSpeedAdjustment > this.speedAdjustmentInterval) {
                await this.adjustAnimationSpeed(currentSpeed);
                this.lastSpeedAdjustment = currentTime;
            }
        }
        
        // Track animation displacement and update position
        await this.trackAnimationDisplacement();
        
        // Ensure character always has an animation playing
        await this.ensureAnimationPlaying();
    }

    // Track animation displacement and sync with logical position
    async trackAnimationDisplacement() {
        if (this.isWalking && this.lastAnimationPosition) {
            const currentActualPosition = await getCharacterPosition(this.character);
            const displacement = {
                x: currentActualPosition.x - this.lastAnimationPosition.x,
                z: currentActualPosition.z - this.lastAnimationPosition.z
            };
            
            // If the animation moved the character, update our logical position
            if (Math.abs(displacement.x) > 0.001 || Math.abs(displacement.z) > 0.001) {
                this.currentPosition.x = currentActualPosition.x;
                this.currentPosition.y = currentActualPosition.z; // Note: z maps to y in 2D
                
                console.debug(DEBUG_PREFIX, `${this.character} animation displacement: (${displacement.x.toFixed(3)}, ${displacement.z.toFixed(3)}) -> new position: (${this.currentPosition.x.toFixed(3)}, ${this.currentPosition.y.toFixed(3)})`);
                
                // Update the stored position for next frame
                this.lastAnimationPosition = currentActualPosition;
            }
        }
    }

    // Initialize procedural animation system
    initializeProceduralSystem() {
        this.proceduralSystem = getProceduralAnimationSystem(this.character);
        if (this.proceduralSystem) {
            // Start default continuous animations
            const currentTime = Date.now();
            this.proceduralSystem.startAnimation("Blink", currentTime);
            this.proceduralSystem.startAnimation("Breath", currentTime);
            this.proceduralSystem.startAnimation("IdleSway", currentTime);
            
            console.debug(DEBUG_PREFIX, `${this.character} procedural animation system initialized`);
        } else {
            console.warn(DEBUG_PREFIX, `${this.character} procedural animation system not found`);
        }
    }

    // Update emotion state with smooth transitions
    async updateEmotionState(currentTime) {
        // Check if we should transition to a new emotion
        if (this.targetEmotionState !== this.currentEmotionState) {
            if (this.emotionTransitionStartTime === 0) {
                this.emotionTransitionStartTime = currentTime;
                console.debug(DEBUG_PREFIX, `${this.character} starting emotion transition from ${this.currentEmotionState} to ${this.targetEmotionState}`);
            }
            
            const transitionProgress = Math.min((currentTime - this.emotionTransitionStartTime) / this.emotionTransitionDuration, 1.0);
            
            if (transitionProgress >= 1.0) {
                // Transition complete
                this.currentEmotionState = this.targetEmotionState;
                this.emotionTransitionStartTime = 0;
                this.lastEmotionChangeTime = currentTime;
                
                // Apply the final emotion
                await setExpression(this.character, this.currentEmotionState);
                await this.triggerEmotionalAnimation(this.currentEmotionState);
                
                console.debug(DEBUG_PREFIX, `${this.character} emotion transition completed: ${this.currentEmotionState}`);
            } else {
                // In transition - blend between emotions
                await this.blendEmotions(this.currentEmotionState, this.targetEmotionState, transitionProgress);
            }
        }
        
        // Randomly trigger subtle emotion variations if we've been in the same state long enough
        if (currentTime - this.lastEmotionChangeTime > this.minimumEmotionDuration) {
            if (Math.random() < 0.0003) { // Very small chance per frame
                await this.triggerRandomEmotionVariation(currentTime);
            }
        }
    }

    // Blend between two emotions during transitions
    async blendEmotions(fromEmotion, toEmotion, progress) {
        // Use procedural animations to create micro-expressions during transition
        if (this.proceduralSystem && progress > 0.3 && progress < 0.7) {
            const intensity = Math.sin(progress * Math.PI) * 0.3;
            if (Math.random() < 0.1) { // Occasional micro-nods or blinks during transition
                this.proceduralSystem.nod(getVRM(this.character), intensity, 1.5, 1, Date.now());
            }
        }
    }

    // Trigger emotional animation with procedural enhancements
    async triggerEmotionalAnimation(emotion) {
        if (!this.proceduralSystem) return;
        
        const currentTime = Date.now();
        const vrm = getVRM(this.character);
        
        // Add procedural gestures based on emotion
        switch (emotion) {
            case "joy":
            case "excitement":
                if (Math.random() < 0.7) {
                    this.proceduralSystem.nod(vrm, 0.3, 2.5, 2, currentTime);
                }
                break;
            case "sadness":
            case "disappointment":
                this.proceduralSystem.setBlendWeight("IdleSway", 0.3); // Reduce sway for sadness
                break;
            case "surprise":
            case "fear":
                if (Math.random() < 0.5) {
                    this.proceduralSystem.blink(vrm, 0.8, currentTime);
                }
                break;
            case "anger":
            case "annoyance":
                if (Math.random() < 0.6) {
                    this.proceduralSystem.shake(vrm, 0.2, 2.0, 1, currentTime);
                }
                break;
            case "neutral":
            default:
                this.proceduralSystem.setBlendWeight("IdleSway", 1.0); // Normal sway
                break;
        }
    }

    // Trigger random subtle emotion variation
    async triggerRandomEmotionVariation(currentTime) {
        const variations = ["neutral", "curiosity", "amusement", "admiration"];
        const newEmotion = variations[Math.floor(Math.random() * variations.length)];
        
        if (newEmotion !== this.currentEmotionState) {
            this.targetEmotionState = newEmotion;
            console.debug(DEBUG_PREFIX, `${this.character} random emotion variation triggered: ${newEmotion}`);
        }
    }

    // Callback for when emotion is detected from conversation
    async onEmotionDetected(emotion) {
        if (emotion && emotion !== this.currentEmotionState) {
            const currentTime = Date.now();
            
            // Only change emotion if enough time has passed or it's significantly different
            if (currentTime - this.lastEmotionChangeTime > 1000 || this.isSignificantEmotionChange(emotion)) {
                this.targetEmotionState = emotion;
                this.lastDetectedEmotion = emotion;
                console.debug(DEBUG_PREFIX, `${this.character} emotion detected from conversation: ${emotion}`);
            }
        }
    }

    // Check if emotion change is significant enough to override cooldown
    isSignificantEmotionChange(newEmotion) {
        const strongEmotions = ["joy", "sadness", "anger", "fear", "surprise", "excitement"];
        const currentStrong = strongEmotions.includes(this.currentEmotionState);
        const newStrong = strongEmotions.includes(newEmotion);
        
        return newStrong && !currentStrong;
    }

    // Ensure continuous procedural animations are always running
    ensureContinuousAnimations(currentTime) {
        if (!this.proceduralSystem) return;
        
        // Check and restart essential continuous animations if they stopped
        const essentialAnimations = ["Blink", "Breath", "IdleSway"];
        
        for (const animName of essentialAnimations) {
            if (!this.proceduralSystem.isAnimationActive(animName)) {
                this.proceduralSystem.startAnimation(animName, currentTime);
                console.debug(DEBUG_PREFIX, `${this.character} restarted ${animName} animation`);
            }
        }
    }

    // Protected setMotion wrapper to prevent rapid animation switching
    async setMotionProtected(character, animationPath, loop = false, force = false, random = true, removeRootMotion = false) {
        const currentTime = Date.now();
        
        // Enhanced validation to prevent null/undefined animations
        if (!animationPath || typeof animationPath !== 'string' || animationPath.trim() === '') {
            console.warn(DEBUG_PREFIX, `${character} setMotionProtected received invalid path:`, animationPath, 'using fallback');
            animationPath = this.getRandomAnimation("idle"); // This now guarantees a valid path
        }
        
        // If a new animation is requested while one is already playing, be more aggressive about forcing changes
        // to prevent the weight=0 issue
        if (this.currentAnimationPath !== null && this.currentAnimationPath !== animationPath && !force) {
            const timeSinceStart = currentTime - this.currentAnimationStartTime;
            
            // Be more lenient with animation changes if current animation has weight issues
            if (timeSinceStart > (this.minimumAnimationDuration * 0.5)) {
                console.debug(DEBUG_PREFIX, `${character} allowing animation change due to time elapsed: ${timeSinceStart}ms`);
                force = true; // Override to prevent animation getting stuck
            } else {
                console.debug(DEBUG_PREFIX, `${character} queuing animation: ${animationPath} (current: ${this.currentAnimationPath})`);
                this.animationQueue.push({ animationPath, loop, force, random, removeRootMotion, timestamp: currentTime });
                this.processAnimationQueue(); // Attempt to process immediately
                return false; // Animation queued, not immediately changed
            }
        }

        // Don't interrupt if the same animation is already playing and not forced, unless there might be weight issues
        if (this.currentAnimationPath === animationPath && !force) {
            console.debug(DEBUG_PREFIX, `${character} same animation requested, skipping: ${animationPath}`);
            return false; // Animation not changed
        }

        // Don't interrupt if minimum duration hasn't passed, unless forced
        if (!force && this.currentAnimationStartTime > 0) {
            const timeSinceStart = currentTime - this.currentAnimationStartTime;
            if (timeSinceStart < this.minimumAnimationDuration) {
                console.debug(DEBUG_PREFIX, `${character} animation change blocked - minimum duration not reached (${timeSinceStart}ms < ${this.minimumAnimationDuration}ms)`);
                this.animationQueue.push({ animationPath, loop, force, random, removeRootMotion, timestamp: currentTime });
                this.processAnimationQueue();
                return false; // Animation change blocked
            }
        }

        console.debug(DEBUG_PREFIX, `${character} setting animation: ${animationPath} (loop: ${loop}, force: ${force})`);

        // Set the animation
        // Animation-level anti-repeat: avoid replaying same clip within cooldown window when not forced
try {
    if (!this.recentAnimationPaths) this.recentAnimationPaths = new Map();
    if (this.animationCooldownMs === undefined) this.animationCooldownMs = 7000;
    const lastPlayedTs = this.recentAnimationPaths.get(animationPath) || 0;
    if (!force && (Date.now() - lastPlayedTs) < this.animationCooldownMs) {
        const lower = String(animationPath).toLowerCase();
        let alt = null;
        if (lower.includes("idle")) alt = this.getRandomAnimation("idle");
        else if (lower.includes("dance")) alt = this.getRandomAnimation("dance");
        else if (lower.includes("exercise")) alt = this.getRandomAnimation("exercise");
        else if (lower.includes("walk")) alt = this.getRandomAnimation("walk", this.getWalkStyle());
        if (alt && alt !== animationPath) {
            console.debug(DEBUG_PREFIX, `${character} switched to alt animation due to cooldown: ${alt}`);
            animationPath = alt;
        }
    }
} catch(e) {
    // ignore anti-repeat errors
}

// Set the animation
await setMotion(character, animationPath, loop, force, random, removeRootMotion);

// Add subtle variation to the animation (except for walking, which has its own speed control)
if (!this.isWalking) {
    setTimeout(async () => {
        await this.addAnimationVariation();
    }, 100); // Small delay to ensure animation is loaded
}

// Record last played timestamp for anti-repeat
try {
    if (!this.recentAnimationPaths) this.recentAnimationPaths = new Map();
    this.recentAnimationPaths.set(animationPath, Date.now());
} catch(e) {}

        // Track the animation
        this.currentAnimationStartTime = currentTime;
        this.currentAnimationPath = animationPath;

        console.debug(DEBUG_PREFIX, `${character} animation changed to: ${animationPath}`);
        return true; // Animation changed successfully
    }

    // Ensure character always has an animation playing with continuous emoting
    async ensureAnimationPlaying() {
        const currentTime = Date.now();
        
        // Update emotion state
        await this.updateEmotionState(currentTime);
        
        // Ensure continuous procedural animations are running
        this.ensureContinuousAnimations(currentTime);
        
        // Update procedural animations
        if (this.proceduralSystem) {
            const vrm = getVRM(this.character);
            if (vrm) {
                this.proceduralSystem.update(vrm, currentTime, 16); // Assume ~60fps
            }
        }
        
        // Check if we need a fallback animation - increased frequency to prevent animation breaks
        if (!this.isMoving && !this.isWalking && Math.random() < 0.002) { // Increased from 0.0005 to 0.002 for better reliability
            const idleAnimation = this.getRandomAnimation("idle");
            const changed = await this.setMotionProtected(this.character, idleAnimation, true, false, true);
            if (changed) {
                console.debug(DEBUG_PREFIX, `${this.character} fallback idle animation triggered`);
            }
        }
    }

    // Get walk style based on emotion and speed
    getWalkStyle() {
        const emotion = this.lastDetectedEmotion;
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);

        if (emotion === "sadness" && speed < 0.015) {
            return "sad";
        }

        if (emotion === "joy" && speed > 0.018) {
            return "drunk"; // Using drunk for a more energetic walk
        }

        return "neutral";
    }
    
    // Update smooth rotation towards movement direction
    async updateSmoothRotation(directionX, directionY) {
        // Calculate target rotation from movement direction
        const targetRotation = Math.atan2(directionX, directionY);
        
        // Get current rotation or initialize if needed
        if (this.currentRotation === undefined) {
            this.currentRotation = 0;
        }
        
        // Calculate shortest rotation path
        let rotationDiff = targetRotation - this.currentRotation;
        if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
        
        // Very aggressive rotation speed to ensure it happens immediately
        const effectiveRotationSpeed = this.isWalking ? this.rotationSpeed * 6 : this.rotationSpeed * 3;
        
        // Smoothly interpolate rotation
        this.currentRotation += rotationDiff * effectiveRotationSpeed;
        
        // Safety check: ensure rotation is valid
        if (isNaN(this.currentRotation) || !isFinite(this.currentRotation)) {
            console.error(DEBUG_PREFIX, `${this.character} invalid rotation detected! Resetting to 0.`);
            this.currentRotation = 0;
        }
        
        // Normalize rotation to [-PI, PI] range
        while (this.currentRotation > Math.PI) this.currentRotation -= 2 * Math.PI;
        while (this.currentRotation < -Math.PI) this.currentRotation += 2 * Math.PI;
        
        // Update character rotation (only Y rotation for turning)
        try {
            await updateCharacterRotation(this.character, 0, this.currentRotation, 0);
            console.debug(DEBUG_PREFIX, `Smoothly rotating ${this.character} to ${this.currentRotation.toFixed(3)} rad (target: ${targetRotation.toFixed(3)})`);
        } catch (error) {
            console.warn(DEBUG_PREFIX, `Could not rotate character ${this.character}:`, error);
        }
    }
    
    // Find the nearest interaction point
    findNearestInteractionPoint() {
        let nearestPoint = null;
        let minDistance = Infinity;
        
        for (const point of this.interactionPoints) {
            const dx = point.x - this.currentPosition.x;
            const dy = point.y - this.currentPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        }
        
        return nearestPoint;
    }
    
    // Move to the nearest interaction point
    async moveToNearestInteractionPoint() {
        const point = this.findNearestInteractionPoint();
        if (point) {
            await this.moveTo(point.x, point.y);
            return point;
        }
        return null;
    }
    
    // Snap position to grid
    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }
    
    // Move character to a new position with smooth movement
    async moveTo(x, y) {
        // Use smaller grid for smoother movement
        const snappedTargetRaw = this.snapToGrid(x, y);
        // Clamp target to world bounds to avoid choosing unreachable/out-of-bounds goals
        const snappedTarget = {
            x: Math.max(this.worldBounds.minX + this.boundaryMargin, Math.min(this.worldBounds.maxX - this.boundaryMargin, snappedTargetRaw.x)),
            y: Math.max(this.worldBounds.minY + this.boundaryMargin, Math.min(this.worldBounds.maxY - this.boundaryMargin, snappedTargetRaw.y))
        };
        
        // Calculate distance
        const dx = snappedTarget.x - this.currentPosition.x;
        const dy = snappedTarget.y - this.currentPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Set target and start moving
        this.targetPosition = { x: snappedTarget.x, y: snappedTarget.y };
        this.isMoving = true;
        
        // Initialize target rotation and start turning immediately (predictive rotation)
        this.targetRotation = Math.atan2(dx, dy);
        if (this.currentRotation === undefined) {
            this.currentRotation = 0; // Start facing forward
        }
        
        // Start turning towards target immediately for more natural movement
        const currentTime = Date.now();
        await this.updateSmoothRotation(dx / distance, dy / distance);
        this.lastRotationUpdate = currentTime;
        
        console.debug(DEBUG_PREFIX, `${this.character} starting movement to (${snappedTarget.x.toFixed(2)}, ${snappedTarget.y.toFixed(2)}) - distance: ${distance.toFixed(2)}`);
    }
    
    // Move character to a new position with pathfinding and smooth movement
    async moveToWithPathfinding(x, y) {
        // Use smaller grid for smoother movement
        const snappedTargetRaw = this.snapToGrid(x, y);
        // Clamp target to world bounds to avoid choosing unreachable/out-of-bounds goals
        const snappedTarget = {
            x: Math.max(this.worldBounds.minX + this.boundaryMargin, Math.min(this.worldBounds.maxX - this.boundaryMargin, snappedTargetRaw.x)),
            y: Math.max(this.worldBounds.minY + this.boundaryMargin, Math.min(this.worldBounds.maxY - this.boundaryMargin, snappedTargetRaw.y))
        };
        
        // Convert 2D position to 3D (assuming y is height)
        const target3D = { x: snappedTarget.x, y: 0, z: snappedTarget.y };
        const current3D = { x: this.currentPosition.x, y: 0, z: this.currentPosition.y };
        
        // Find path using environment system
        const path = environmentSystem.findPath(current3D, target3D);
        
        if (path && path.length > 1) {
            // Follow the path with smooth movement
            this.path = path;
            this.currentPathIndex = 0;
            this.isMoving = true;
            
            // Initialize smooth rotation towards first path point
            const firstTarget = path;
            this.targetRotation = Math.atan2(firstTarget.x - this.currentPosition.x, firstTarget.z - this.currentPosition.y);
            if (this.currentRotation === undefined) {
                this.currentRotation = this.targetRotation;
            }
            
            const totalDistance = Math.sqrt(
                (snappedTarget.x - this.currentPosition.x) ** 2 +
                (snappedTarget.y - this.currentPosition.y) ** 2
            );
            
            console.debug(DEBUG_PREFIX, `${this.character} pathfinding to (${snappedTarget.x.toFixed(2)}, ${snappedTarget.y.toFixed(2)}) - distance: ${totalDistance.toFixed(2)}`);
        } else {
            // Fallback to direct movement
            await this.moveTo(snappedTarget.x, snappedTarget.y);
        }
    }
    
    // Update mouse tracking and character reactions
    async updateMouseTracking(currentTime) {
        try {
            // Get mouse position from the controls system
            await this.getMouseWorldPosition();
            
            // Check if mouse is nearby
            const dx = this.mouseWorldPosition.x - this.currentPosition.x;
            const dy = this.mouseWorldPosition.y - this.currentPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const wasMouseNearby = this.isMouseNearby;
            this.isMouseNearby = distance <= this.mouseNearbyDistance;
            
            // Only update look direction at intervals to prevent jitter
            if (currentTime - this.lastMouseLookTime > this.mouseLookInterval) {
                if (this.isMouseNearby) {
                    // Start looking at mouse
                    if (!this.isLookingAtMouse) {
                        this.isLookingAtMouse = true;
                        console.debug(DEBUG_PREFIX, `${this.character} started looking at mouse`);
                    }
                    
                    // Turn to face mouse if not moving
                    if (!this.isMoving) {
                        await this.lookAtMouse();
                    }
                    
                    this.lastMouseLookTime = currentTime;
                } else if (wasMouseNearby && !this.isMouseNearby) {
                    // Mouse moved away, stop looking
                    this.isLookingAtMouse = false;
                    await this.stopLookingAtMouse();
                }
            }
        } catch (error) {
            // Silently handle mouse tracking errors to avoid spam
            // console.debug(DEBUG_PREFIX, `Mouse tracking error for ${this.character}:`, error);
        }
    }
    
    // Get mouse position in world coordinates with improved calculation
    async getMouseWorldPosition() {
        try {
            // Import necessary modules
            const { renderer, camera } = await import('./vrm.js');
            
            if (!renderer || !camera) return;
            
            // Get mouse position from DOM
            const canvas = document.getElementById(VRM_CANVAS_ID);
            if (!canvas) return;
            
            // Set up mouse position tracking if not already done
            if (!window.mousePositionInitialized) {
                this.setupMouseTracking(canvas);
                window.mousePositionInitialized = true;
            }
            
            // Get canvas bounds
            const rect = canvas.getBoundingClientRect();
            
            // Get current mouse position
            if (window.currentMouseX === undefined || window.currentMouseY === undefined) {
                return; // Mouse position not available yet
            }
            
            // Convert screen coordinates to normalized device coordinates (-1 to 1)
            const mouseX = ((window.currentMouseX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((window.currentMouseY - rect.top) / rect.height) * 2 + 1;
            
            // Improved world position calculation using proper projection
            const vector = new THREE.Vector3(mouseX, mouseY, 0.5);
            vector.unproject(camera);
            
            // Calculate intersection with ground plane (y = 0)
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.y / dir.y;
            const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));
            
            this.mouseWorldPosition = { x: worldPos.x, y: worldPos.z }; // Use z for y in 2D space
            
        } catch (error) {
            // Fallback to simple calculation if Three.js methods fail
            this.fallbackMouseWorldPosition();
        }
    }
    
    // Set up mouse position tracking
    setupMouseTracking(canvas) {
        const updateMousePosition = (event) => {
            window.currentMouseX = event.clientX;
            window.currentMouseY = event.clientY;
        };
        
        // Track mouse movement over the entire document
        document.addEventListener('mousemove', updateMousePosition, { passive: true });
        canvas.addEventListener('mousemove', updateMousePosition, { passive: true });
        
        // Initialize with current position if available
        if (event && event.clientX !== undefined) {
            window.currentMouseX = event.clientX;
            window.currentMouseY = event.clientY;
        }
    }
    
    // Fallback mouse world position calculation
    fallbackMouseWorldPosition() {
        try {
            const canvas = document.getElementById(VRM_CANVAS_ID);
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            
            if (window.currentMouseX === undefined || window.currentMouseY === undefined) {
                return;
            }
            
            // Simple projection calculation
            const mouseX = ((window.currentMouseX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((window.currentMouseY - rect.top) / rect.height) * 2 + 1;
            
            // Approximate world coordinates (assuming camera at z=5)
            const worldX = mouseX * 3; // Rough scale factor
            const worldY = mouseY * 3;
            
            this.mouseWorldPosition = { x: worldX, y: worldY };
        } catch (error) {
            // Final fallback
            this.mouseWorldPosition = { x: 0, y: 0 };
        }
    }
    
    // Make character look at mouse position with improved head tracking
    async lookAtMouse() {
        try {
            // Get character's current position for relative calculations
            const charPos = getCharacterPosition(this.character);
            
            // Calculate look direction from character to mouse
            const lookDirection = {
                x: this.mouseWorldPosition.x - charPos.x,
                y: this.mouseWorldPosition.y - charPos.y,
                z: 0 // Ground level
            };
            
            // Normalize the look direction
            const length = Math.sqrt(lookDirection.x * lookDirection.x + lookDirection.y * lookDirection.y);
            if (length > 0) {
                lookDirection.x /= length;
                lookDirection.y /= length;
            }
            
            // Use head tracking with the calculated direction
            await updateCharacterHeadLook(
                this.character,
                charPos.x + lookDirection.x,
                charPos.y + 0.2, // Look slightly above ground level
                charPos.z + lookDirection.y
            );
            
            console.debug(DEBUG_PREFIX, `${this.character} head looking at mouse: char(${charPos.x.toFixed(2)}, ${charPos.y.toFixed(2)}) -> mouse(${this.mouseWorldPosition.x.toFixed(2)}, ${this.mouseWorldPosition.y.toFixed(2)})`);
        } catch (error) {
            console.warn(DEBUG_PREFIX, `Could not make ${this.character} look at mouse:`, error);
        }
    }
    
    // Stop looking at mouse and return to neutral
    async stopLookingAtMouse() {
        try {
            await resetCharacterHeadLook(this.character);
            console.debug(DEBUG_PREFIX, `${this.character} stopped looking at mouse`);
        } catch (error) {
            console.warn(DEBUG_PREFIX, `Could not reset ${this.character} head look:`, error);
        }
    }
    
    // Check if user is present based on last message time
    checkUserPresence(currentTime) {
        this.userPresent = (currentTime - this.lastUserMessageTime) < this.userPresenceTimeout;
    }
    
    // Request next behavior from LLM before current sequence ends
    async requestNextBehavior() {
        if (!this.useLLM || !this.llmAPIKey) return;
        
        const context = getContext();
        const emotion = this.lastDetectedEmotion || await this.getCurrentEmotion();
        
        // Get next behavior from LLM
        const behavior = await this.getLLMBehavior(context, emotion);
        
        if (behavior) {
            // Calculate when to execute this behavior (a few seconds before next update)
            const executeTime = Date.now() + 5000; // 5 seconds from now
            this.pendingBehavior = { behavior, executeTime };
            
            // Schedule next request
            this.nextBehaviorRequestTime = executeTime - 3000; // Request 3 seconds before execution
        } else {
            // If no behavior received, request again sooner
            this.nextBehaviorRequestTime = Date.now() + 5000;
        }
    }
    
    // Get current emotional state from context
    async getCurrentEmotion() {
        // Return current emotion state instead of always neutral
        return this.currentEmotionState || "neutral";
    }
    
    // Enhanced idle behavior with more complex and varied sequences
    async getIdleBehavior(emotion) {
        // Time-based behavior weights (different behaviors are more likely at different times)
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 22;
        const isMorning = hour >= 6 && hour < 12;
        const isAfternoon = hour >= 12 && hour < 18;
        
        // Context-aware behavior sequences
        const behaviorSequences = [
            // Contemplative sequences - more complex chains
            {
                theme: "deep_contemplation",
                weight: isNight ? 3 : 1,
                sequence: [
                    { type: "expression", value: "neutral" },
                    { type: "move", value: { x: 0, y: 0 } }, // Move to center
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: false },
                    { type: "procedural", value: "nod", intensity: 0.3, count: 2 }, // Thoughtful nodding
                    { type: "move", value: { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 } },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true } // Ensure idle loops
                ]
            },
            // Morning energy sequences
            {
                theme: "morning_stretch",
                weight: isMorning ? 4 : 1,
                sequence: [
                    { type: "expression", value: "happy" },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false },
                    { type: "procedural", value: "stretch", duration: 2.0 },
                    { type: "move", value: { x: Math.random() * 3 - 1.5, y: Math.random() * 3 - 1.5 } },
                    { type: "expression", value: "neutral" }
                ]
            },
            // Interactive exploration with environment awareness
            {
                theme: "environment_interaction",
                weight: this.userPresent ? 1 : 2,
                sequence: [
                    { type: "expression", value: "surprised" },
                    { type: "interaction_point", value: "nearest" },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false },
                    { type: "procedural", value: "look_around", duration: 3.0 }
                ]
            },
            // Social awareness behaviors (respond to user presence)
            {
                theme: "user_awareness",
                weight: this.userPresent ? 5 : 0,
                sequence: [
                    { type: "face_user", value: true }, // Turn towards user area
                    { type: "expression", value: "happy" },
                    { type: "procedural", value: "wave", intensity: 0.5 },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true } // Ensure idle loops
                ]
            },
            // Multi-step exploration sequences
            {
                theme: "thorough_exploration",
                weight: !this.userPresent ? 1 : 0.5,
                sequence: [
                    { type: "move", value: { x: Math.random() * 1 - 0.5, y: Math.random() * 1 - 0.5 } },
                    { type: "procedural", value: "look_around", duration: 2.0 },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true },
                    { type: "expression", value: "neutral" }
                ]
            },
            // Emotional response sequences
            {
                theme: "emotional_expression",
                weight: 2,
                sequence: [
                    { type: "expression", value: emotion === "neutral" ? ["happy", "surprised", "neutral"][Math.floor(Math.random() * 3)] : emotion },
                    { type: "motion", value: this.getEmotionalMotion(emotion), loop: false },
                    { type: "procedural", value: emotion === "sad" ? "sigh" : "subtle_movement" },
                    { type: "move", value: this.getEmotionalMovement(emotion) }
                ]
            },
            // Rhythmic movement sequences
            {
                theme: "rhythmic_movement",
                weight: isAfternoon ? 2 : 1,
                sequence: [
                    { type: "motion", value: this.getRandomAnimation("dance"), loop: false },
                    { type: "procedural", value: "sway", duration: 3.0 }
                ]
            },
            // Enhanced activity behaviors for more variety
            {
                theme: "stretching_routine",
                weight: 4,
                sequence: [
                    { type: "expression", value: "neutral" },
                    { type: "motion", value: this.getRandomAnimation("exercise"), loop: false },
                    { type: "procedural", value: "stretch", duration: 3.0 },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true }
                ]
            },
            {
                theme: "greeting_practice",
                weight: 3,
                sequence: [
                    { type: "expression", value: "happy" },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false },
                    { type: "procedural", value: "wave", intensity: 0.6 },
                    { type: "face_user", value: true },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true }
                ]
            },
            {
                theme: "observation_and_thinking",
                weight: 3,
                sequence: [
                    { type: "move", value: { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 } },
                    { type: "expression", value: "surprised" },
                    { type: "procedural", value: "look_around", duration: 4.0 },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false },
                    { type: "expression", value: "neutral" }
                ]
            },
            {
                theme: "creative_activities",
                weight: 2,
                sequence: [
                    { type: "move", value: { x: Math.random() * 1.5 - 0.75, y: Math.random() * 1.5 - 0.75 } },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false },
                    { type: "expression", value: "admiration" },
                    { type: "procedural", value: "nod", intensity: 0.4, count: 2 },
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true }
                ]
            },
            // Simple behaviors for balance (reduced weight)
            {
                theme: "simple_idle",
                weight: 1,
                sequence: [
                    { type: "motion", value: this.getRandomAnimation("idle"), loop: true }
                ]
            },
            {
                theme: "simple_adjustment",
                weight: 2,
                sequence: [
                    { type: "move", value: { x: Math.random() * 0.8 - 0.4, y: Math.random() * 0.8 - 0.4 } },
                    { type: "procedural", value: "adjust_posture" },
                    { type: "motion", value: this.getRandomAnimation("activity"), loop: false }
                ]
            },
            // New: Dance sequence
            {
                theme: "dance_party",
                weight: isAfternoon ? 6 : 2, // Increased likelihood
                sequence: [
                    { type: "expression", value: "happy" },
                    { type: "motion", value: this.getRandomAnimation("dance"), loop: false },
                    { type: "procedural", value: "wave", intensity: 0.7 },
                    { type: "move", value: { x: Math.random() * 1 - 0.5, y: Math.random() * 1 - 0.5 } }
                ]
            },
            // New: Exercise sequence
            {
                theme: "workout_time",
                weight: isMorning ? 5 : 2, // Increased likelihood
                sequence: [
                    { type: "expression", value: "neutral" },
                    { type: "motion", value: this.getRandomAnimation("exercise"), loop: false },
                    { type: "procedural", value: "stretch", duration: 2.0 },
                    { type: "move", value: { x: Math.random() * 0.5 - 0.25, y: Math.random() * 0.5 - 0.25 } }
                ]
            },
            // New: Reading/Contemplation sequence
            {
                theme: "reading_contemplation",
                weight: isNight ? 5 : 2, // Increased likelihood
                sequence: [
                    { type: "expression", value: "neutral" },
                    { type: "motion", value: this.getRandomAnimation("sit_idle"), loop: true }, // Assuming a sitting idle animation
                    { type: "procedural", value: "nod", intensity: 0.1, count: 1 },
                    { type: "procedural", value: "look_around", duration: 2.0 }
                ]
            }
        ];
        
        // Weighted random selection with theme cooldowns (anti-repeat)
        const nowTs = Date.now();
        if (!this.recentThemes) this.recentThemes = new Map();
        if (!this.themeCooldowns) {
            this.themeCooldowns = {
                walk: 8000, move: 8000, idle: 4000, activity: 5000,
                dance_party: 12000, rhythmic_movement: 9000, workout_time: 12000,
                reading_contemplation: 12000, stretching_routine: 9000, greeting_practice: 6000,
                observation_and_thinking: 7000, creative_activities: 9000,
                environment_interaction: 9000, thorough_exploration: 10000, emotional_expression: 7000
            };
        }

        const pool = behaviorSequences.filter(seq => {
            const last = this.recentThemes.get(seq.theme) || 0;
            const cd = this.themeCooldowns[seq.theme] ?? 0;
            return (nowTs - last) >= cd;
        });
        const activePool = pool.length > 0 ? pool : behaviorSequences;

        const totalWeight = activePool.reduce((sum, seq) => sum + seq.weight, 0);
        let randomWeight = Math.random() * Math.max(1, totalWeight);
        
        for (const sequence of activePool) {
            randomWeight -= sequence.weight;
            if (randomWeight <= 0) {
                this.recentThemes.set(sequence.theme, nowTs);
                return {
                    type: "sequence",
                    value: sequence.sequence,
                    theme: sequence.theme
                };
            }
        }

        // Fallback: choose first available and record cooldown
        const fallbackSeq = activePool[0] || behaviorSequences[0];
        if (fallbackSeq) {
            this.recentThemes.set(fallbackSeq.theme, nowTs);
            return {
                type: "sequence",
                value: fallbackSeq.sequence,
                theme: fallbackSeq.theme
            };
        }

        // Last resort: neutral idle
        return { type: "motion", value: this.getRandomAnimation("idle"), loop: true, theme: "idle" };
    }
    
    // Get emotional motion based on detected emotion
    getEmotionalMotion(emotion) {
        return this.getRandomAnimation("emotional_response", emotion) || this.getRandomAnimation("emotional_response", "neutral");
    }
    
    // Get emotional movement pattern based on detected emotion
    getEmotionalMovement(emotion) {
        const movements = {
            "happy": { x: Math.random() * 4 - 2, y: Math.random() * 4 - 2 }, // Energetic movement
            "sad": { x: -1.5 - Math.random() * 1, y: -1.5 - Math.random() * 1 }, // Move away, corner
            "angry": { x: Math.random() * 2 - 1, y: 0 }, // Side-to-side agitation
            "surprised": { x: 0, y: Math.random() * 1.5 }, // Forward movement (curiosity)
            "neutral": { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 } // Random gentle movement
        };
        return movements[emotion] || movements["neutral"];
    }

    // Get a random animation from a group with robust fallbacks
    getRandomAnimation(group, subGroup = null) {
        let animations;
        if (subGroup) {
            animations = ANIMATION_GROUPS[group]?.[subGroup];
        } else {
            animations = ANIMATION_GROUPS[group];
        }

        // If we found animations in the requested group/subgroup
        if (animations && Array.isArray(animations) && animations.length > 0) {
            return animations[Math.floor(Math.random() * animations.length)];
        }

        // Fallback 1: Try neutral emotional_response if we were looking for an emotion
        if (group === "emotional_response" && subGroup !== "neutral") {
            console.debug(DEBUG_PREFIX, `Animation not found for ${group}/${subGroup}, trying neutral`);
            const neutralAnimations = ANIMATION_GROUPS.emotional_response?.neutral;
            if (neutralAnimations && neutralAnimations.length > 0) {
                return neutralAnimations[Math.floor(Math.random() * neutralAnimations.length)];
            }
        }

        // Fallback 2: Try idle animations
        if (group !== "idle") {
            console.debug(DEBUG_PREFIX, `Animation not found for ${group}/${subGroup}, trying idle`);
            const idleAnimations = ANIMATION_GROUPS.idle;
            if (idleAnimations && idleAnimations.length > 0) {
                return idleAnimations[Math.floor(Math.random() * idleAnimations.length)];
            }
        }

        // Fallback 3: Ultimate fallback - hardcoded neutral animation
        console.warn(DEBUG_PREFIX, `No animation found for ${group}/${subGroup}, using hardcoded fallback`);
        return "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh";
    }
    
    // Get emotion-based behavior
    async getEmotionBehavior(emotion) {
        const motion = this.getRandomAnimation("emotional_response", emotion) || this.getRandomAnimation("emotional_response", "neutral");
        const movement = this.getEmotionalMovement(emotion);

        const behaviors = [
            { type: "motion", value: motion, loop: false },
            { type: "expression", value: emotion },
            { type: "sequence", value: [
                { type: "move", value: movement },
                { type: "motion", value: motion, loop: false }
            ]}
        ];

        return behaviors[Math.floor(Math.random() * behaviors.length)];
    }
    
    // Get default behavior
    async getDefaultBehavior(emotion) {
        return { type: "motion", value: "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh", loop: true };
    }
    
    // Enhanced behavior execution with new behavior types
    async executeBehavior(behavior) {
        if (!behavior) return;
        
        console.debug(DEBUG_PREFIX, 'Executing behavior for', this.character, ':', behavior);
        
        switch (behavior.type) {
            case "expression":
                await setExpression(this.character, behavior.value);
                break;
                
            case "motion":
                // Enhanced validation for motion path
                let motionPath = behavior.value;
                
                if (!motionPath || motionPath === undefined || motionPath === 'undefined' || motionPath === null || typeof motionPath !== 'string' || motionPath.trim() === '') {
                    console.warn(DEBUG_PREFIX, 'Motion behavior has invalid value, using fallback animation. Original value:', behavior.value);
                    motionPath = this.getRandomAnimation("idle"); // Use our improved method
                    
                    // Double-check the fallback worked
                    if (!motionPath) {
                        motionPath = "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh";
                    }
                }
                
                try {
                    console.debug(DEBUG_PREFIX, `Executing motion for ${this.character}: ${motionPath} (loop: ${behavior.loop || false})`);
                    await setMotion(this.character, motionPath, behavior.loop || false);
                } catch (error) {
                    console.error(DEBUG_PREFIX, 'Error executing motion behavior:', error, 'behavior:', behavior);
                    // Try one more fallback if the motion failed
                    try {
                        const emergencyFallback = "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh";
                        console.warn(DEBUG_PREFIX, `Motion failed, trying emergency fallback: ${emergencyFallback}`);
                        await setMotion(this.character, emergencyFallback, true);
                    } catch (fallbackError) {
                        console.error(DEBUG_PREFIX, 'Even emergency fallback motion failed:', fallbackError);
                    }
                }
                break;
                
            case "move":
                await this.moveToWithPathfinding(behavior.value.x, behavior.value.y);
                break;
                
            case "explore":
                await this.exploreEnvironment();
                break;
                
            case "sequence":
                // Execute a sequence of behaviors
                await this.executeBehaviorSequence(behavior.value);
                break;
                
            case "procedural":
                // Execute procedural animation
                await this.executeProceduralBehavior(behavior);
                break;
                
            case "interaction_point":
                // Move to interaction point
                await this.executeInteractionPointBehavior(behavior.value);
                break;
                
            case "face_user":
                // Face towards user/camera area
                await this.faceUserArea();
                break;
                
            default:
                console.warn(DEBUG_PREFIX, `Unknown behavior type: ${behavior.type}`);
        }
        
        this.lastBehaviorTime = Date.now();
    }
    
    // Execute procedural animation behaviors
    async executeProceduralBehavior(behavior) {
        try {
            const proceduralSystem = getProceduralAnimationSystem && getProceduralAnimationSystem(this.character);
            if (!proceduralSystem) {
                console.warn(DEBUG_PREFIX, `No procedural animation system available for ${this.character}`);
                return;
            }
            
            const time = Date.now();
            const { value, intensity = 1.0, duration = 2.0, count = 1 } = behavior;
            
            switch (value) {
                case "nod":
                    proceduralSystem.nod(null, intensity, 2.0, count, time);
                    break;
                case "shake":
                    proceduralSystem.shake(null, intensity, 3.0, count, time);
                    break;
                case "wave":
                    // Custom wave animation - could be expanded
                    console.debug(DEBUG_PREFIX, `${this.character} performing wave gesture`);
                    break;
                case "stretch":
                    console.debug(DEBUG_PREFIX, `${this.character} performing stretch motion`);
                    break;
                case "look_around":
                    await this.executeSubtleLookAround(duration);
                    break;
                case "sway":
                    console.debug(DEBUG_PREFIX, `${this.character} performing idle sway`);
                    break;
                case "adjust_posture":
                    console.debug(DEBUG_PREFIX, `${this.character} adjusting posture`);
                    break;
                case "sigh":
                    console.debug(DEBUG_PREFIX, `${this.character} performing sigh gesture`);
                    break;
                case "subtle_movement":
                    console.debug(DEBUG_PREFIX, `${this.character} performing subtle movement`);
                    break;
                default:
                    console.warn(DEBUG_PREFIX, `Unknown procedural behavior: ${value}`);
            }
            
            // Wait for duration if specified
            if (duration > 0) {
                await new Promise(resolve => setTimeout(resolve, duration * 1000));
            }
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error executing procedural behavior:`, error);
        }
    }
    
    // Enhanced interaction point behavior execution
    async executeInteractionPointBehavior(pointType) {
        try {
            let selectedPoint = null;
            
            switch (pointType) {
                case "nearest":
                    selectedPoint = this.findNearestInteractionPoint();
                    break;
                case "random":
                    selectedPoint = this.interactionPoints[Math.floor(Math.random() * this.interactionPoints.length)];
                    break;
                case "contextual":
                    selectedPoint = this.selectContextualInteractionPoint();
                    break;
                default:
                    // Specific named interaction point
                    selectedPoint = this.interactionPoints.find(p => p.name === pointType);
            }
            
            if (selectedPoint) {
                // Move to the interaction point
                await this.moveToWithPathfinding(selectedPoint.x, selectedPoint.y);
                console.debug(DEBUG_PREFIX, `${this.character} moved to interaction point: ${selectedPoint.name} (${selectedPoint.description})`);
                
                // Execute the interaction behavior
                const behaviorSet = this.interactionBehaviors[selectedPoint.behavior];
                if (behaviorSet && behaviorSet.actions) {
                    console.debug(DEBUG_PREFIX, `Executing ${selectedPoint.behavior} behavior at ${selectedPoint.name}`);
                    for (const action of behaviorSet.actions) {
                        await this.executeBehavior(action);
                        // Small delay between actions for natural flow
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error executing interaction point behavior:`, error);
        }
    }
    
    // Select contextually appropriate interaction point
    selectContextualInteractionPoint() {
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 22;
        const isMorning = hour >= 6 && hour < 12;
        
        // Context-based selection weights
        let weights = {};
        
        if (this.userPresent) {
            // When user is present, prefer social/welcoming points
            weights = {
                "social_corner": 4,
                "center": 3,
                "entrance": 3,
                "stage_area": 2,
                "observation_deck": 2
            };
        } else if (isNight) {
            // At night, prefer quiet/contemplative points
            weights = {
                "quiet_corner": 4,
                "thinking_spot": 3,
                "center": 2
            };
        } else if (isMorning) {
            // In morning, prefer energetic/creative points
            weights = {
                "activity_zone": 4,
                "creative_space": 3,
                "stage_area": 2,
                "center": 2
            };
        } else {
            // Default distribution
            weights = {
                "center": 2,
                "observation_deck": 2,
                "thinking_spot": 2,
                "social_corner": 1,
                "activity_zone": 1
            };
        }
        
        // Weighted random selection
        const weightedPoints = this.interactionPoints.filter(p => weights[p.name] > 0);
        if (weightedPoints.length === 0) return this.interactionPoints; // Fallback
        
        const totalWeight = weightedPoints.reduce((sum, point) => sum + (weights[point.name] || 1), 0);
        let randomWeight = Math.random() * totalWeight;
        
        for (const point of weightedPoints) {
            randomWeight -= weights[point.name] || 1;
            if (randomWeight <= 0) {
                return point;
            }
        }
        
        return weightedPoints; // Fallback
    }
    
    // Face towards user area (camera/center)
    async faceUserArea() {
        try {
            // Face towards camera/center area where user typically is
            await faceCamera(this.character);
            console.debug(DEBUG_PREFIX, `${this.character} turning to face user area`);
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error facing user area:`, error);
        }
    }
    
    // Execute subtle look around behavior
    async executeSubtleLookAround(duration = 3.0) {
        try {
            // Look in different directions over the duration
            const directions = [
                { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 },
                { x: 0, y: -0.5 }, { x: 0, y: 0 }
            ];
            
            const intervalTime = (duration * 1000) / directions.length;
            
            for (const dir of directions) {
                const charPos = getCharacterPosition(this.character);
                await updateCharacterHeadLook(
                    this.character,
                    charPos.x + dir.x,
                    charPos.y + 0.2,
                    charPos.z + dir.y
                );
                await new Promise(resolve => setTimeout(resolve, intervalTime));
            }
            
            // Return to neutral
            await resetCharacterHeadLook(this.character);
            console.debug(DEBUG_PREFIX, `${this.character} completed look around behavior`);
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error in look around behavior:`, error);
        }
    }
    
    // Explore the environment
    async exploreEnvironment() {
        // Find a random walkable position
        const randomPos = environmentSystem.getRandomWalkablePosition();
        await this.moveToWithPathfinding(randomPos.x, randomPos.z);
        
        // Play exploration animation
        await setMotion(this.character, "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh", false);
    }
    
    // Execute a sequence of behaviors
    async executeBehaviorSequence(sequence) {
        for (let i = 0; i < sequence.length; i++) {
            const behavior = sequence[i];
            
            // Execute the behavior
            await this.executeBehavior(behavior);
            
            // If this is a motion behavior, wait for it to complete (unless it's looping)
            if (behavior.type === "motion" && !behavior.loop) {
                // Get the actual duration of the animation
                const duration = await getAnimationFileDuration(this.character, behavior.value);
                if (duration > 0) {
                    await new Promise(resolve => setTimeout(resolve, duration * 1000));
                } else {
                    // Fallback to estimated duration
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // Small delay between behaviors in a sequence
            if (i < sequence.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    
    // Update behavior history
    updateBehaviorHistory(behavior) {
        this.behaviorHistory.push({
            behavior: behavior,
            timestamp: Date.now()
        });
        
        // Keep only the last N behaviors
        if (this.behaviorHistory.length > this.maxHistoryLength) {
            this.behaviorHistory.shift();
        }
    }
    
    // Call LLM to get dynamic behavior (Gemini API)
    async getLLMBehavior(context, emotion) {
        try {
            // Skip if LLM is not configured
            if (!this.useLLM || !this.llmAPIKey) {
                return null;
            }
            
            // Create cache key
            const cacheKey = `${emotion}-${this.userPresent}-${context.chat.length}`;
            
            // Check cache first
            if (this.behaviorCache.has(cacheKey)) {
                const cached = this.behaviorCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.behavior;
                } else {
                    // Remove expired cache entry
                    this.behaviorCache.delete(cacheKey);
                }
            }
            
            // Prepare the prompt for the LLM
            const recentMessages = context.chat.slice(-5).map(m => 
                `${m.name}: ${m.mes}`
            ).join("\n");
            
            // Determine behavior context based on user presence
            const behaviorContext = this.userPresent 
                ? "The user is actively chatting with the character. Respond with appropriate animations and movements to engage with the user."
                : "The user has not sent a message in a while. The character should explore their environment, move around to different interaction points, or do other activities.";
            
            // Format interaction points for the prompt
            const interactionPointsStr = this.interactionPoints.map(p => 
                `${p.name} at (${p.x}, ${p.y}) - behavior: ${p.behavior}`
            ).join("\n");
            
            // Get environment objects
            const environmentObjects = environmentSystem.objects.map(obj =>
                `${obj.name} at (${obj.position.x.toFixed(2)}, ${obj.position.z.toFixed(2)}) - type: ${obj.interactionType}`
            ).join("\n") || "No objects available";
            
            // Enhanced LLM prompt with better context awareness
            const timeOfDay = new Date().getHours();
            const timeContext = timeOfDay < 6 ? "late night" :
                               timeOfDay < 12 ? "morning" :
                               timeOfDay < 18 ? "afternoon" : "evening";
            
            const recentBehaviorThemes = this.behaviorHistory.slice(-3).map(b => b.behavior.theme || "unknown").join(", ");
            const behaviorDiversity = recentBehaviorThemes ? `Recent behavior themes: ${recentBehaviorThemes}` : "No recent behavior history";
            
            const proximityToPoints = this.interactionPoints.map(p => {
                const dx = p.x - this.currentPosition.x;
                const dy = p.y - this.currentPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return `${p.name}: ${distance.toFixed(1)} units away (${p.description})`;
            }).join("\n");
            
            const prompt = `
                ## CHARACTER CONTEXT
                Character Name: ${this.character}
                Current Emotion: ${emotion}
                User Presence: ${this.userPresent ? "Present and active" : "Away/inactive"}
                Time of Day: ${timeContext} (${timeOfDay}:00)
                Current Position: (${this.currentPosition.x.toFixed(2)}, ${this.currentPosition.y.toFixed(2)})
                Current Activity: ${this.isMoving ? "Moving" : "Stationary"}
                
                ## BEHAVIORAL CONTEXT
                ${behaviorContext}
                ${behaviorDiversity}
                
                ## RECENT CONVERSATION
                ${recentMessages || "No recent messages"}
                
                ## SPATIAL ENVIRONMENT
                The character exists in a 3D space with coordinates from -2.0 to 2.0 on X and Z axes.
                Center of the screen is at (0, 0).
                
                Distance to interaction points:
                ${proximityToPoints}
                
                Interactive objects in environment:
                ${environmentObjects}
                
                ## AVAILABLE ACTIONS
                Animation Groups: idle, walk (neutral, sad, drunk), activity, emotional_response (admiration, amusement, anger, etc.)
                Expressions: ${CLASSIFY_EXPRESSIONS.join(", ")}
                Procedural Actions: nod, shake, wave, stretch, look_around, sway, sigh
                Movement: Any coordinate within bounds
                Interaction Points: ${this.interactionPoints.map(p => p.name).join(", ")}
                
                ## BEHAVIOR GUIDELINES
                - Create behaviors that match the current emotion and context
                - Consider time of day for activity levels (quiet at night, energetic in morning)
                - When user is present, be more engaging and social
                - When user is away, explore environment and be autonomous
                - Avoid repeating recent behavior themes unless appropriate
                - Use sequences for more complex, multi-step behaviors
                - Prefer contextual interaction points over random movement
                
                ## RESPONSE FORMAT
                Respond ONLY with a JSON object. Choose the most appropriate format:
                
                Single Motion:
                {"type": "motion", "value": "animation_path", "loop": true/false}
                
                Expression Change:
                {"type": "expression", "value": "expression_name"}
                
                Movement:
                {"type": "move", "value": {"x": 0.5, "y": -0.3}}
                
                Interaction Point Visit:
                {"type": "interaction_point", "value": "contextual"}
                
                Environment Exploration:
                {"type": "explore", "value": "random"}
                
                Face User:
                {"type": "face_user", "value": true}
                
                Procedural Animation:
                {"type": "procedural", "value": "nod", "intensity": 0.5, "duration": 2.0}
                
                Complex Sequence (preferred for rich behaviors):
                {"type": "sequence", "value": [
                    {"type": "interaction_point", "value": "contextual"},
                    {"type": "expression", "value": "expression_name"},
                    {"type": "procedural", "value": "look_around", "duration": 3.0},
                    {"type": "face_user", "value": true}
                ]}
                
                Consider the full context and create a behavior that feels natural and engaging for this specific situation.
            `;
            
            // Prepare the Gemini API request
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.llmAPIKey}`;
            
            const body = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300,
                    response_mime_type: "application/json"
                }
            };
            
            // Make the API call
            const response = await fetch(geminiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                throw new Error(`Gemini API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!content) {
                throw new Error("Gemini API returned no content");
            }
            
            // Try to parse the response as JSON
            try {
                const behavior = JSON.parse(content);
                
                // Cache the behavior
                this.behaviorCache.set(cacheKey, {
                    behavior: behavior,
                    timestamp: Date.now()
                });
                
                return behavior;
            } catch (parseError) {
                console.warn("Gemini returned invalid JSON, using fallback behavior");
                return null;
            }
        } catch (error) {
            console.error("Error calling Gemini for behavior:", error);
            return null;
        }
    }
    
    // Configure LLM integration
    configureLLM(useLLM, apiKey) {
        this.useLLM = useLLM;
        this.llmAPIKey = apiKey;
    }
    
    // Update last user message time
    onUserMessage() {
        this.lastUserMessageTime = Date.now();
        this.userPresent = true;
        // Reset behavior request timing
        this.nextBehaviorRequestTime = Date.now() + 5000;
    }
    
    // Set character's current position
    setCurrentPosition(x, y) {
        this.currentPosition = { x, y };
    }

    // Clear any pending animations in the queue
    clearPendingAnimations() {
        this.animationQueue = [];
        this.isProcessingQueue = false;
        console.debug(DEBUG_PREFIX, `${this.character} animation queue cleared.`);
    }

    // Process the animation queue
    async processAnimationQueue() {
        if (this.isProcessingQueue || this.animationQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        while (this.animationQueue.length > 0) {
            const nextAnimation = this.animationQueue[0]; // Fix: was accessing entire array instead of first element
            const currentTime = Date.now();

            // Check if enough time has passed since the last animation started
            const timeSinceLastAnimation = currentTime - this.currentAnimationStartTime;
            if (timeSinceLastAnimation < this.minimumAnimationDuration && !nextAnimation.force) {
                console.debug(DEBUG_PREFIX, `${this.character} animation queue: Not enough time for ${nextAnimation.animationPath}. Waiting.`);
                this.isProcessingQueue = false;
                setTimeout(() => this.processAnimationQueue(), this.minimumAnimationDuration - timeSinceLastAnimation + 50);
                return;
            }

            // Attempt to play the next animation with force to prevent weight issues
            console.debug(DEBUG_PREFIX, `${this.character} processing queued animation: ${nextAnimation.animationPath}`);
            
            // Call setMotion directly to avoid recursion and ensure proper weight handling
            try {
                await setMotion(
                    this.character,
                    nextAnimation.animationPath,
                    nextAnimation.loop,
                    true, // Force the animation to prevent weight conflicts
                    nextAnimation.random,
                    nextAnimation.removeRootMotion
                );
                
                // Update tracking
                this.currentAnimationStartTime = currentTime;
                this.currentAnimationPath = nextAnimation.animationPath;
                
                // Dequeue the successfully processed animation
                this.animationQueue.shift();
                console.debug(DEBUG_PREFIX, `${this.character} dequeued and started animation: ${nextAnimation.animationPath}`);
                
                // Small delay to allow animation to stabilize before processing next
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(DEBUG_PREFIX, `${this.character} failed to start queued animation: ${nextAnimation.animationPath}`, error);
                // Remove the failed animation from queue to prevent infinite loop
                this.animationQueue.shift();
            }
        }
        this.isProcessingQueue = false;
        console.debug(DEBUG_PREFIX, `${this.character} animation queue empty.`);
    }

    // Protected setExpression wrapper to prevent rapid expression switching
    async setExpressionProtected(character, expressionValue) {
        const currentTime = Date.now();
        // Add logic here if you need to queue expressions or have a minimum duration for them
        // For now, directly call setExpression
        await setExpression(character, expressionValue);
        console.debug(DEBUG_PREFIX, `${character} expression changed to: ${expressionValue}`);
    }

    // Ensure character is visible and at a valid position
    async ensureCharacterVisible() {
        try {
            const position = await getCharacterPosition(this.character);
            
            // Check if character position is invalid or out of bounds
            if (!position || 
                isNaN(position.x) || isNaN(position.z) || 
                !isFinite(position.x) || !isFinite(position.z) ||
                Math.abs(position.x) > 10 || Math.abs(position.z) > 10) {
                
                console.warn(DEBUG_PREFIX, `${this.character} appears to be missing or at invalid position, recovering...`);
                
                // Reset to safe position
                this.currentPosition = { x: 0, y: 0 };
                this.velocity = { x: 0, y: 0 };
                this.isMoving = false;
                this.isWalking = false;
                this.path = null;
                this.targetPosition = null;
                this.currentRotation = 0;
                this.targetRotation = 0;
                
                // Update position immediately
                await updateCharacterPosition(this.character, 0, 0);
                await updateCharacterRotation(this.character, 0, 0, 0);
                
                // Set idle animation to make sure character is visible
                const idleAnimation = this.getRandomAnimation("idle");
                await this.setMotionProtected(this.character, idleAnimation, true, true);
                
                console.warn(DEBUG_PREFIX, `${this.character} recovered to center position`);
            }
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error checking character visibility for ${this.character}:`, error);
        }
    }

    // Adjust animation playback speed based on movement velocity
    async adjustAnimationSpeed(currentSpeed) {
        try {
            const vrm = getVRM(this.character);
            if (!vrm || !vrm.mixer) return;

            // Get current animation action
            const currentAction = vrm.mixer._actions.find(action => 
                action.isRunning() && !action.terminated && action.getEffectiveWeight() > 0
            );

            if (!currentAction) return;

            // Improved speed calculation for better sync across all speeds
            let speedMultiplier;
            
            if (currentSpeed < 0.01) {
                // Very slow movement - use very slow animation
                speedMultiplier = Math.max(0.2, currentSpeed / 0.01 * 0.4);
            } else if (currentSpeed < 0.03) {
                // Slow movement - gradual speed increase
                speedMultiplier = 0.4 + ((currentSpeed - 0.01) / 0.02) * 0.4; // 0.4 to 0.8
            } else if (currentSpeed <= this.maxSpeed) {
                // Normal to fast movement - linear scaling to 1.0x at maxSpeed
                speedMultiplier = 0.8 + ((currentSpeed - 0.03) / (this.maxSpeed - 0.03)) * 0.4; // 0.8 to 1.2
            } else {
                // Very fast movement - cap at 1.5x for realism
                speedMultiplier = Math.min(1.5, 1.2 + ((currentSpeed - this.maxSpeed) / this.maxSpeed) * 0.3);
            }

            // Add subtle random variation (±3%) for more natural movement
            const variation = 0.97 + (Math.random() * 0.06); // 0.97 to 1.03
            const finalSpeed = speedMultiplier * variation;

            // Apply the speed adjustment
            currentAction.setEffectiveTimeScale(finalSpeed);

            console.debug(DEBUG_PREFIX, `${this.character} animation speed adjusted to ${finalSpeed.toFixed(3)}x (speed: ${currentSpeed.toFixed(4)}, base: ${speedMultiplier.toFixed(3)})`);

        } catch (error) {
            console.warn(DEBUG_PREFIX, `Could not adjust animation speed for ${this.character}:`, error);
        }
    }

    // Add subtle variations to animations for visual diversity
    async addAnimationVariation() {
        try {
            const vrm = getVRM(this.character);
            if (!vrm || !vrm.mixer) return;

            // Get current animation action
            const currentAction = vrm.mixer._actions.find(action => 
                action.isRunning() && !action.terminated && action.getEffectiveWeight() > 0
            );

            if (!currentAction) return;

            // Add subtle speed variation for idle animations (±10%)
            const speedVariation = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
            currentAction.setEffectiveTimeScale(speedVariation);

            // Slight random time offset to make animations feel less synchronized
            const timeOffset = Math.random() * 0.5; // 0 to 0.5 seconds
            if (currentAction.getClip()) {
                const duration = currentAction.getClip().duration;
                currentAction.time = (currentAction.time + timeOffset) % duration;
            }

            console.debug(DEBUG_PREFIX, `${this.character} animation variation applied - speed: ${speedVariation.toFixed(3)}x, offset: ${timeOffset.toFixed(3)}s`);

        } catch (error) {
            console.warn(DEBUG_PREFIX, `Could not apply animation variation for ${this.character}:`, error);
        }
    }
}