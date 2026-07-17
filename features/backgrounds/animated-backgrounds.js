/**
 * Backward-compatible entry point.
 *
 * The feature is initialized by NemoPresetExt's lifecycle. Keeping this file
 * as a side-effect-free re-export prevents legacy direct imports from creating
 * a second instance or patching SillyTavern globals.
 */

export { AnimatedBackgroundsModule, animatedBackgrounds } from './animated-backgrounds-module.js';
