import * as THREE from './lib/three.module.js';
import { DEBUG_PREFIX } from "./constants.js";

export {
    ProceduralAnimationSystem,
    ProceduralAnimation,
    AnimationBlendMode,
    EasingFunction
}

// Blend modes for procedural animations
const AnimationBlendMode = {
    OVERRIDE: 0,     // Completely override the base animation
    ADDITIVE: 1,     // Add to the base animation
    MULTIPLY: 2      // Multiply with the base animation
};

// Easing functions for smooth transitions
const EasingFunction = {
    Linear: (t) => t,
    EaseInQuad: (t) => t * t,
    EaseOutQuad: (t) => t * (2 - t),
    EaseInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    EaseInCubic: (t) => t * t * t,
    EaseOutCubic: (t) => (--t) * t * t + 1,
    EaseInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    EaseInQuart: (t) => t * t * t * t,
    EaseOutQuart: (t) => 1 - (--t) * t * t * t,
    EaseInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
    EaseInQuint: (t) => t * t * t * t * t,
    EaseOutQuint: (t) => 1 + (--t) * t * t * t * t,
    EaseInOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
};

// Base class for procedural animations
class ProceduralAnimation {
    constructor(name, duration = 1.0, easing = EasingFunction.Linear, blendMode = AnimationBlendMode.ADDITIVE) {
        this.name = name;
        this.duration = duration;
        this.easing = easing;
        this.blendMode = blendMode;
        this.startTime = 0;
        this.isActive = false;
        this.isLooping = false;
        this.weight = 1.0;
        this.onCompleteCallback = null;
    }

    // Start the animation
    start(time) {
        this.startTime = time;
        this.isActive = true;
    }

    // Stop the animation
    stop() {
        this.isActive = false;
        if (this.onCompleteCallback) {
            this.onCompleteCallback();
        }
    }

    // Update the animation
    update(time, deltaTime) {
        if (!this.isActive) return 0;

        const elapsed = time - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1.0);
        const easedProgress = this.easing(progress);

        // Handle completion
        if (progress >= 1.0) {
            if (this.isLooping) {
                this.startTime = time;
                return easedProgress;
            } else {
                this.stop();
                return 1.0;
            }
        }

        return easedProgress;
    }

    // Set completion callback
    onComplete(callback) {
        this.onCompleteCallback = callback;
        return this;
    }

    // Set looping
    setLooping(loop) {
        this.isLooping = loop;
        return this;
    }

    // Set weight
    setWeight(weight) {
        this.weight = weight;
        return this;
    }
}

// Specific procedural animation types
class HeadLookAtAnimation extends ProceduralAnimation {
    constructor(target, speed = 2.0) {
        super("HeadLookAt", 1.0, EasingFunction.EaseOutQuad);
        this.target = target;
        this.speed = speed;
        this.currentRotation = new THREE.Euler();
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.lookAt) return;

        // Update look at target
        vrm.lookAt.target = this.target;
    }
}

class BlinkAnimation extends ProceduralAnimation {
    constructor(blinkIntensity = 1.0, minBlinkInterval = 2000, maxBlinkInterval = 8000) {
        super("Blink", 0.2, EasingFunction.EaseInOutQuad);
        this.blinkIntensity = blinkIntensity;
        this.minBlinkInterval = minBlinkInterval;
        this.maxBlinkInterval = maxBlinkInterval;
        this.nextBlinkTime = 0;
        this.isBlinking = false;
    }

    update(time, deltaTime) {
        // Handle automatic blinking
        if (time >= this.nextBlinkTime && !this.isBlinking) {
            this.start(time);
            this.isBlinking = true;
            // Schedule next blink
            this.nextBlinkTime = time + this.minBlinkInterval + 
                Math.random() * (this.maxBlinkInterval - this.minBlinkInterval);
        }

        if (this.isActive) {
            const progress = super.update(time, deltaTime);
            if (!this.isActive) {
                this.isBlinking = false;
            }
            return progress;
        }

        return 0;
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.expressionManager) return;

        // Apply blink expression with easing
        const blinkValue = progress < 0.5 ? 
            this.easing(progress * 2) * this.blinkIntensity : 
            this.easing((1 - progress) * 2) * this.blinkIntensity;

        vrm.expressionManager.setValue("blink", blinkValue * this.weight);
    }
}

class BreathAnimation extends ProceduralAnimation {
    constructor(intensity = 0.2, speed = 1.0) {
        super("Breath", 4.0, EasingFunction.Linear);
        this.intensity = intensity;
        this.speed = speed;
        this.setLooping(true);
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.humanoid) return;

        // Apply subtle chest breathing motion
        const breathValue = Math.sin(time * this.speed * 0.001) * this.intensity * this.weight;
        
        const chest = vrm.humanoid.getNormalizedBoneNode("chest");
        const upperChest = vrm.humanoid.getNormalizedBoneNode("upperChest");
        
        if (chest) {
            chest.position.y += breathValue * 0.1;
        }
        
        if (upperChest) {
            upperChest.position.y += breathValue * 0.05;
        }
    }
}

class IdleSwayAnimation extends ProceduralAnimation {
    constructor(intensity = 0.05, speed = 0.5) {
        super("IdleSway", 6.0, EasingFunction.Linear);
        this.intensity = intensity;
        this.speed = speed;
        this.setLooping(true);
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.humanoid) return;

        // Apply subtle idle sway motion
        const swayX = Math.sin(time * this.speed * 0.001) * this.intensity * this.weight;
        const swayY = Math.sin(time * this.speed * 0.002) * this.intensity * 0.5 * this.weight;
        
        const hips = vrm.humanoid.getNormalizedBoneNode("hips");
        if (hips) {
            hips.rotation.z += swayX * 0.1;
            hips.rotation.x += swayY * 0.05;
        }
    }
}

class NodAnimation extends ProceduralAnimation {
    constructor(intensity = 0.2, speed = 2.0, count = 1) {
        super("Nod", 1.0, EasingFunction.EaseInOutQuad);
        this.intensity = intensity;
        this.speed = speed;
        this.count = count;
        this.currentNod = 0;
    }

    update(time, deltaTime) {
        if (!this.isActive) return 0;

        const elapsed = time - this.startTime;
        const nodProgress = (elapsed / this.duration) * this.count;
        const currentNod = Math.floor(nodProgress);
        const subProgress = nodProgress - currentNod;
        
        const progress = this.easing(subProgress);

        // Handle completion
        if (nodProgress >= this.count) {
            if (this.isLooping) {
                this.startTime = time;
                return progress;
            } else {
                this.stop();
                return 1.0;
            }
        }

        return progress;
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.humanoid) return;

        // Apply nodding motion
        const nodValue = Math.sin(progress * Math.PI) * this.intensity * this.weight;
        
        const neck = vrm.humanoid.getNormalizedBoneNode("neck");
        const head = vrm.humanoid.getNormalizedBoneNode("head");
        
        if (neck) {
            neck.rotation.x += nodValue * 0.5;
        }
        
        if (head) {
            head.rotation.x += nodValue;
        }
    }
}

class ShakeAnimation extends ProceduralAnimation {
    constructor(intensity = 0.2, speed = 3.0, count = 2) {
        super("Shake", 1.0, EasingFunction.EaseInOutQuad);
        this.intensity = intensity;
        this.speed = speed;
        this.count = count;
    }

    update(time, deltaTime) {
        if (!this.isActive) return 0;

        const elapsed = time - this.startTime;
        const shakeProgress = (elapsed / this.duration) * this.count;
        const currentShake = Math.floor(shakeProgress);
        const subProgress = shakeProgress - currentShake;
        
        const progress = this.easing(subProgress);

        // Handle completion
        if (shakeProgress >= this.count) {
            if (this.isLooping) {
                this.startTime = time;
                return progress;
            } else {
                this.stop();
                return 1.0;
            }
        }

        return progress;
    }

    apply(vrm, progress, time) {
        if (!vrm || !vrm.humanoid) return;

        // Apply shaking motion
        const shakeValue = Math.sin(progress * Math.PI * 2) * this.intensity * this.weight;
        
        const neck = vrm.humanoid.getNormalizedBoneNode("neck");
        const head = vrm.humanoid.getNormalizedBoneNode("head");
        
        if (neck) {
            neck.rotation.z += shakeValue * 0.5;
        }
        
        if (head) {
            head.rotation.z += shakeValue;
        }
    }
}

// Main procedural animation system
class ProceduralAnimationSystem {
    constructor() {
        this.animations = new Map();
        this.activeAnimations = new Set();
        this.blendWeights = new Map();
        this.isInitialized = false;
    }

    // Initialize the system
    initialize() {
        if (this.isInitialized) return;
        
        // Create default procedural animations
        this.createDefaultAnimations();
        this.isInitialized = true;
        
        console.debug(DEBUG_PREFIX, "Procedural Animation System initialized");
    }

    // Create default procedural animations
    createDefaultAnimations() {
        // Add default animations that should always be available
        this.addAnimation(new BlinkAnimation());
        this.addAnimation(new BreathAnimation());
        this.addAnimation(new IdleSwayAnimation());
    }

    // Add a procedural animation
    addAnimation(animation) {
        this.animations.set(animation.name, animation);
        return this;
    }

    // Remove a procedural animation
    removeAnimation(name) {
        this.animations.delete(name);
        this.activeAnimations.delete(name);
        return this;
    }

    // Start a procedural animation
    startAnimation(name, time) {
        const animation = this.animations.get(name);
        if (animation) {
            animation.start(time);
            this.activeAnimations.add(name);
            return animation;
        }
        return null;
    }

    // Stop a procedural animation
    stopAnimation(name) {
        const animation = this.animations.get(name);
        if (animation) {
            animation.stop();
            this.activeAnimations.delete(name);
        }
        return this;
    }

    // Stop all animations
    stopAllAnimations() {
        for (const name of this.activeAnimations) {
            this.stopAnimation(name);
        }
        return this;
    }

    // Update all active procedural animations
    update(vrm, time, deltaTime) {
        if (!vrm || !this.isInitialized) return;

        // Update all active animations
        for (const name of this.activeAnimations) {
            const animation = this.animations.get(name);
            if (animation && animation.isActive) {
                const progress = animation.update(time, deltaTime);
                // Apply the animation
                animation.apply(vrm, progress, time);
            }
        }
    }

    // Get animation by name
    getAnimation(name) {
        return this.animations.get(name);
    }

    // Check if animation is active
    isAnimationActive(name) {
        return this.activeAnimations.has(name);
    }

    // Set blend weight for an animation
    setBlendWeight(name, weight) {
        this.blendWeights.set(name, weight);
        const animation = this.animations.get(name);
        if (animation) {
            animation.setWeight(weight);
        }
        return this;
    }

    // Get blend weight for an animation
    getBlendWeight(name) {
        return this.blendWeights.get(name) || 1.0;
    }

    // Create and start a temporary animation
    createTempAnimation(animClass, name, ...args) {
        const animation = new animClass(...args);
        animation.name = name;
        this.addAnimation(animation);
        return animation;
    }

    // Create and play a temporary nod animation
    nod(vrm, intensity = 0.2, speed = 2.0, count = 1, time) {
        const nodAnim = new NodAnimation(intensity, speed, count);
        nodAnim.name = `nod_${Date.now()}`;
        this.addAnimation(nodAnim);
        nodAnim.onComplete(() => {
            this.removeAnimation(nodAnim.name);
        });
        nodAnim.start(time);
        this.activeAnimations.add(nodAnim.name);
        return nodAnim;
    }

    // Create and play a temporary shake animation
    shake(vrm, intensity = 0.2, speed = 3.0, count = 2, time) {
        const shakeAnim = new ShakeAnimation(intensity, speed, count);
        shakeAnim.name = `shake_${Date.now()}`;
        this.addAnimation(shakeAnim);
        shakeAnim.onComplete(() => {
            this.removeAnimation(shakeAnim.name);
        });
        shakeAnim.start(time);
        this.activeAnimations.add(shakeAnim.name);
        return shakeAnim;
    }

    // Create and play a temporary blink animation
    blink(vrm, intensity = 1.0, time) {
        const blinkAnim = new BlinkAnimation(intensity);
        blinkAnim.name = `blink_${Date.now()}`;
        this.addAnimation(blinkAnim);
        blinkAnim.onComplete(() => {
            this.removeAnimation(blinkAnim.name);
        });
        blinkAnim.start(time);
        this.activeAnimations.add(blinkAnim.name);
        return blinkAnim;
    }
}