# Nemo extension hub architecture

NemoPresetExt remains the lightweight UX foundation and trusted catalog for independently installed Nemo extensions. Optional products are normal SillyTavern extensions with their own repositories, manifests, release histories, settings namespaces, and lifecycle cleanup.

## Installation boundary

The Hub delegates installation to SillyTavern's exported `installExtension` function. It never downloads or evaluates JavaScript directly from GitHub. User-scoped installation is the default; global installation is reserved for an explicit administrator workflow.

## Initial catalog

- **NemoLore** — standalone memory and lore extension. The older bundled implementation remains temporarily as migration input only.
- **Ember** — standalone interactive scripting and artifact extension.

## Extraction order

1. Prove install and installed-state handling with NemoLore and Ember.
2. Keep the bundled NemoLore runtime retired while preserving its localforage records for an explicit migration/export path.
3. Extract NemoRewrite into its own repository.
4. Extract the connection router/pipeline suite.
5. Evaluate World Info, backgrounds/media, persona, marketplace, and onboarding bundles by shared dependency density before splitting them.

An extraction is complete only when the standalone extension has a manifest, documentation, tests, settings migration, independent cleanup, and a Hub catalog entry.
