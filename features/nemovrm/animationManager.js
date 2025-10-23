import * as THREE from './lib/three.module.js';
import { DEBUG_PREFIX, ANIMATION_FADE_TIME } from "./constants.js";
import { ANIMATION_GROUPS } from "./animations.js";

/**
 * Unified Animation Manager
 * Consolidates all animation systems into one coherent manager
 */
export class AnimationManager {
    constructor(character, vrm, mixer) {
        this.character = character;
        this.vrm = vrm;
        this.mixer = mixer;
        
        // Animation state
        this.currentAnimation = null;
        this.currentAnimationPath = null;
        this.animationStartTime = 0;
        this.minimumAnimationDuration = 1000; // 1 second
        this.isTransitioning = false;
        
        // Animation queue for smooth transitions
        this.animationQueue = [];
        this.lastUpdate = 0;
        
        // State tracking
        this.isWalking = false;
        this.isMoving = false;
        this.shouldLoop = false;
        
        // Fallback system
        this.fallbackAnimationPath = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
        this.lastSuccessfulAnimation = null;
        
        console.debug(DEBUG_PREFIX, `AnimationManager created for ${character}`);
    }
    
    /**
     * Set a new animation with proper error handling and fallbacks
     */
    async setAnimation(animationPath, loop = false, force = false) {
        const currentTime = Date.now();
        
        try {
            // Validate inputs
            if (!animationPath || typeof animationPath !== 'string') {
                console.error(DEBUG_PREFIX, `Invalid animation path for ${this.character}:`, animationPath);
                return await this.setFallbackAnimation(loop);
            }
            
            // Check if we can change animation
            if (!this.canChangeAnimation(animationPath, force)) {
                console.debug(DEBUG_PREFIX, `Animation change blocked for ${this.character}: ${animationPath}`);
                return false;
            }
            
            console.debug(DEBUG_PREFIX, `Setting animation for ${this.character}: ${animationPath} (loop: ${loop}, force: ${force})`);
            
            // Load the animation clip
            const clip = await this.loadAnimationClip(animationPath);
            if (!clip) {
                console.error(DEBUG_PREFIX, `Failed to load animation clip for ${this.character}: ${animationPath}`);
                return await this.setFallbackAnimation(loop);
            }
            
            // Create new animation action
            const newAction = this.mixer.clipAction(clip);
            if (!newAction) {
                console.error(DEBUG_PREFIX, `Failed to create animation action for ${this.character}: ${animationPath}`);
                return await this.setFallbackAnimation(loop);
            }
            
            // Handle transition from current animation
            await this.transitionToNewAnimation(newAction, loop);
            
            // Update state
            this.currentAnimation = newAction;
            this.currentAnimationPath = animationPath;
            this.animationStartTime = currentTime;
            this.shouldLoop = loop;
            this.lastSuccessfulAnimation = animationPath;
            
            console.debug(DEBUG_PREFIX, `Successfully set animation for ${this.character}: ${animationPath}`);
            return true;
            
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error setting animation for ${this.character}:`, error);
            return await this.setFallbackAnimation(loop);
        }
    }
    
    /**
     * Check if we can change to a new animation
     */
    canChangeAnimation(animationPath, force) {
        const currentTime = Date.now();
        
        // Always allow if forced
        if (force) return true;
        
        // Allow if no current animation
        if (!this.currentAnimation) return true;
        
        // Allow if same animation (for looping changes)
        if (this.currentAnimationPath === animationPath) return true;
        
        // Check minimum duration
        if (this.animationStartTime > 0) {
            const elapsed = currentTime - this.animationStartTime;
            if (elapsed < this.minimumAnimationDuration) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Load animation clip from path
     */
    async loadAnimationClip(animationPath) {
        try {
            // This would integrate with your existing animation loading system
            // For now, return null to trigger fallback
            console.debug(DEBUG_PREFIX, `Loading animation clip: ${animationPath}`);
            
            // TODO: Integrate with existing loadAnimation function from vrm.js
            // const clip = await loadAnimation(this.vrm, hipsHeight, animationPath);
            // return clip;
            
            return null; // Temporary - will be implemented
            
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error loading animation clip ${animationPath}:`, error);
            return null;
        }
    }
    
    /**
     * Transition smoothly to a new animation
     */
    async transitionToNewAnimation(newAction, loop) {
        const fadeTime = ANIMATION_FADE_TIME * 0.8;
        
        if (this.currentAnimation && this.currentAnimation.isRunning()) {
            // Fade out current animation
            this.currentAnimation.fadeOut(fadeTime);
            this.currentAnimation.terminated = true;
            
            // Start new animation with fade in
            newAction
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(0)
                .fadeIn(fadeTime)
                .play();
                
            this.isTransitioning = true;
            
            // Clear transition flag after fade completes
            setTimeout(() => {
                this.isTransitioning = false;
            }, fadeTime * 1000);
            
            console.debug(DEBUG_PREFIX, `Transitioning ${this.character} from ${this.currentAnimationPath} with ${fadeTime}s fade`);
        } else {
            // No current animation, start immediately
            newAction
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .play();
                
            console.debug(DEBUG_PREFIX, `Starting ${this.character} animation immediately`);
        }
        
        // Set looping
        if (loop) {
            newAction.setLoop(THREE.LoopRepeat, Infinity);
        } else {
            newAction.setLoop(THREE.LoopOnce, 1);
            newAction.clampWhenFinished = true;
        }
        
        newAction.terminated = false;
    }
    
    /**
     * Set fallback animation to ensure character always has animation
     */
    async setFallbackAnimation(loop = true) {
        const fallbackPath = this.lastSuccessfulAnimation || this.fallbackAnimationPath;
        
        console.warn(DEBUG_PREFIX, `Using fallback animation for ${this.character}: ${fallbackPath}`);
        
        try {
            // Recursive call but with simpler logic to prevent infinite loops
            if (fallbackPath !== this.fallbackAnimationPath) {
                return await this.setAnimation(fallbackPath, loop, true);
            } else {
                // Ultimate fallback - use neutral animation directly
                console.error(DEBUG_PREFIX, `All animations failed for ${this.character}, using hardcoded neutral`);
                return false; // Let the system handle this
            }
        } catch (error) {
            console.error(DEBUG_PREFIX, `Fallback animation failed for ${this.character}:`, error);
            return false;
        }
    }
    
    /**
     * Get random animation from a group with fallbacks
     */
    getRandomAnimation(group, subGroup = null) {
        try {
            let animations;
            if (subGroup) {
                animations = ANIMATION_GROUPS[group]?.[subGroup];
            } else {
                animations = ANIMATION_GROUPS[group];
            }
            
            if (animations && animations.length > 0) {
                const randomIndex = Math.floor(Math.random() * animations.length);
                return animations[randomIndex];
            }
            
            // Fallback to neutral if group not found
            if (group !== 'emotional_response' || subGroup !== 'neutral') {
                console.warn(DEBUG_PREFIX, `Animation group not found: ${group}/${subGroup}, trying neutral`);
                return this.getRandomAnimation('emotional_response', 'neutral');
            }
            
            return this.fallbackAnimationPath;
        } catch (error) {
            console.error(DEBUG_PREFIX, `Error getting random animation:`, error);
            return this.fallbackAnimationPath;
        }
    }
    
    /**
     * Update animation state
     */
    update(deltaTime) {
        const currentTime = Date.now();
        
        // Update mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Check if current animation finished and needs auto-transition
        if (this.currentAnimation && !this.shouldLoop && !this.isTransitioning) {
            if (!this.currentAnimation.isRunning() || this.currentAnimation.terminated) {
                console.debug(DEBUG_PREFIX, `${this.character} animation finished, transitioning to idle`);
                this.setAnimation(this.getRandomAnimation('idle'), true, false);
            }
        }
        
        // Ensure animation is always playing (safety net)
        if (!this.currentAnimation || (!this.currentAnimation.isRunning() && !this.isTransitioning)) {
            if (currentTime - this.lastUpdate > 5000) { // Every 5 seconds
                console.warn(DEBUG_PREFIX, `${this.character} has no running animation, setting idle`);
                this.setAnimation(this.getRandomAnimation('idle'), true, true);
                this.lastUpdate = currentTime;
            }
        }
    }
    
    /**
     * Get current animation state for debugging
     */
    getState() {
        return {
            character: this.character,
            currentAnimationPath: this.currentAnimationPath,
            isRunning: this.currentAnimation?.isRunning() || false,
            weight: this.currentAnimation?.getEffectiveWeight() || 0,
            time: this.currentAnimation?.time || 0,
            duration: this.currentAnimation?.getClip()?.duration || 0,
            terminated: this.currentAnimation?.terminated || false,
            isTransitioning: this.isTransitioning,
            shouldLoop: this.shouldLoop,
            isWalking: this.isWalking,
            isMoving: this.isMoving
        };
    }
    
    /**
     * Force stop all animations
     */
    stopAllAnimations() {
        if (this.currentAnimation) {
            this.currentAnimation.stop();
            this.currentAnimation.terminated = true;
        }
        this.currentAnimation = null;
        this.currentAnimationPath = null;
        this.isTransitioning = false;
    }
    
    /**
     * Dispose of the animation manager
     */
    dispose() {
        this.stopAllAnimations();
        this.animationQueue = [];
        console.debug(DEBUG_PREFIX, `AnimationManager disposed for ${this.character}`);
    }
}

/**
 * Global Animation Manager Registry
 */
export class AnimationManagerRegistry {
    constructor() {
        this.managers = new Map();
    }
    
    /**
     * Create or get animation manager for a character
     */
    getManager(character, vrm, mixer) {
        if (!this.managers.has(character)) {
            this.managers.set(character, new AnimationManager(character, vrm, mixer));
        }
        return this.managers.get(character);
    }
    
    /**
     * Remove manager for a character
     */
    removeManager(character) {
        const manager = this.managers.get(character);
        if (manager) {
            manager.dispose();
            this.managers.delete(character);
        }
    }
    
    /**
     * Update all managers
     */
    updateAll(deltaTime) {
        for (const manager of this.managers.values()) {
            manager.update(deltaTime);
        }
    }
    
    /**
     * Get debug state for all managers
     */
    getDebugState() {
        const state = {};
        for (const [character, manager] of this.managers.entries()) {
            state[character] = manager.getState();
        }
        return state;
    }
}

// Global instance
export const animationManagerRegistry = new AnimationManagerRegistry();