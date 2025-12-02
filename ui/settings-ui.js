// settings-ui.js

import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace } from '../core/utils.js';
import { loadAndSetDividerRegex, NemoPresetManager } from '../features/prompts/prompt-manager.js';
import logger from '../core/logger.js';

export const NemoSettingsUI = {
    initialize: async function() {
        logger.info('NemoSettingsUI: Starting initialization...');
        const pollForSettings = setInterval(async () => {
            const container = document.getElementById('extensions_settings');
            logger.debug('NemoSettingsUI: Polling for settings container...', { found: !!container });
            if (container && !document.querySelector('.nemo-preset-enhancer-settings')) {
                clearInterval(pollForSettings);
                logger.info('NemoSettingsUI: Container found, loading settings...');
                ensureSettingsNamespace();
                // Save settings after ensuring defaults are set
                saveSettingsDebounced();

                try {
                    // Add cache buster to ensure fresh HTML
                    const cacheBuster = `${Date.now()}-${Math.random()}`;
                    const response = await fetch(`scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/settings.html?v=${cacheBuster}`, {
                        cache: 'no-store'
                    });
                    if (!response.ok) {
                        logger.error('Failed to fetch settings.html', response.status);
                        return;
                    }

                    const htmlContent = await response.text();
                    logger.debug('NemoSettingsUI: HTML fetched', { length: htmlContent.length });
                    container.insertAdjacentHTML('beforeend', htmlContent);
                    logger.info('NemoSettingsUI: HTML inserted successfully');

                    // Regex Settings
                    const regexInput = /** @type {HTMLInputElement} */ (document.getElementById('nemoDividerRegexPattern'));
                    const saveButton = document.getElementById('nemoSaveRegexSettings');
                    const statusDiv = document.getElementById('nemoRegexStatus');

                    if (!regexInput || !saveButton || !statusDiv) {
                        logger.error('NemoSettingsUI: Could not find required elements', {regexInput: !!regexInput, saveButton: !!saveButton, statusDiv: !!statusDiv});
                        return;
                    }

                    regexInput.value = extension_settings[NEMO_EXTENSION_NAME]?.dividerRegexPattern || '';
                    saveButton.addEventListener('click', async () => {
                    const customPatternString = regexInput.value.trim();
                    try {
                        if (customPatternString) {
                            customPatternString.split(',').map(p => p.trim()).filter(Boolean).forEach(p => new RegExp(p));
                        }
                        extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = customPatternString;
                        saveSettingsDebounced();
                        await loadAndSetDividerRegex();
                        await NemoPresetManager.organizePrompts();
                        statusDiv.textContent = 'Pattern saved!'; statusDiv.style.color = 'lightgreen';
                    } catch(e) {
                        statusDiv.textContent = `Invalid Regex part: ${e.message}`; statusDiv.style.color = 'red';
                    }
                    setTimeout(() => statusDiv.textContent = '', 4000);
                });

                // Core Feature Toggles
                const promptManagerToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnablePromptManager'));
                if (promptManagerToggle) {
                    promptManagerToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enablePromptManager ?? true;
                    promptManagerToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enablePromptManager = promptManagerToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                const presetNavigatorToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnablePresetNavigator'));
                if (presetNavigatorToggle) {
                    presetNavigatorToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enablePresetNavigator ?? true;
                    presetNavigatorToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enablePresetNavigator = presetNavigatorToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                const directivesToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableDirectives'));
                if (directivesToggle) {
                    directivesToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectives ?? true;
                    directivesToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableDirectives = directivesToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                const directiveAutocompleteToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableDirectiveAutocomplete'));
                if (directiveAutocompleteToggle) {
                    directiveAutocompleteToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectiveAutocomplete ?? true;
                    directiveAutocompleteToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableDirectiveAutocomplete = directiveAutocompleteToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                // Animated Backgrounds Setting
                const animatedBgToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableAnimatedBackgrounds'));
                if (animatedBgToggle) {
                    animatedBgToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableAnimatedBackgrounds ?? true;
                    animatedBgToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableAnimatedBackgrounds = animatedBgToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                // Lorebook Overhaul Setting
                const lorebookToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableLorebookOverhaul'));
                if (lorebookToggle) {
                    lorebookToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookOverhaul ?? true;
                    lorebookToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableLorebookOverhaul = lorebookToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                // Reasoning Section Setting
                const reasoningToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableReasoningSection'));
                reasoningToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableReasoningSection ?? true;
                reasoningToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableReasoningSection = reasoningToggle.checked;
                    saveSettingsDebounced();
                    // Refresh the UI to show/hide the reasoning section
                    NemoPresetManager.refreshUI();
                });

                // Lorebook Management Setting
                const lorebookManagementToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableLorebookManagement'));
                lorebookManagementToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookManagement ?? true;
                lorebookManagementToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableLorebookManagement = lorebookManagementToggle.checked;
                    saveSettingsDebounced();
                    // Refresh the UI to show/hide the lorebook management section
                    NemoPresetManager.refreshUI();
                });

                // HTML Trimming Settings
                const htmlTrimmingToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableHTMLTrimming'));
                const htmlTrimmingKeepCount = /** @type {HTMLInputElement} */ (document.getElementById('nemoHTMLTrimmingKeepCount'));
                const manualTrimButton = document.getElementById('nemoManualHTMLTrim');
                const trimStatus = document.getElementById('nemoHTMLTrimStatus');

                logger.debug('NemoSettingsUI: HTML Trimming UI elements', {
                    toggle: !!htmlTrimmingToggle,
                    keepCount: !!htmlTrimmingKeepCount,
                    button: !!manualTrimButton,
                    status: !!trimStatus
                });

                if (htmlTrimmingToggle && htmlTrimmingKeepCount && manualTrimButton) {
                    logger.debug('NemoSettingsUI: Attaching HTML trimming event listeners');
                    htmlTrimmingToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableHTMLTrimming ?? false;
                    htmlTrimmingKeepCount.value = extension_settings[NEMO_EXTENSION_NAME]?.htmlTrimmingKeepCount || 4;

                    htmlTrimmingToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableHTMLTrimming = htmlTrimmingToggle.checked;
                        saveSettingsDebounced();
                        logger.info(`HTML trimming ${htmlTrimmingToggle.checked ? 'enabled' : 'disabled'}`);
                    });

                    htmlTrimmingKeepCount.addEventListener('change', () => {
                        const value = parseInt(htmlTrimmingKeepCount.value);
                        if (value >= 2 && value <= 20) {
                            extension_settings[NEMO_EXTENSION_NAME].htmlTrimmingKeepCount = value;
                            saveSettingsDebounced();
                            logger.info(`HTML trimming keep count set to ${value}`);
                        }
                    });

                    manualTrimButton.addEventListener('click', async () => {
                        logger.info('Manual HTML trim requested');
                        trimStatus.textContent = 'Trimming...';
                        trimStatus.style.color = '#aaa';

                        try {
                            // Dynamic import of HTML trimmer
                            const { trimOldMessagesHTML } = await import('../reasoning/html-trimmer.js');
                            const keepCount = parseInt(htmlTrimmingKeepCount.value);
                            logger.debug('NemoSettingsUI: Calling trimOldMessagesHTML', { keepCount });

                            const result = trimOldMessagesHTML(keepCount);
                            logger.debug('NemoSettingsUI: Trim result', result);

                            if (result.trimmed > 0) {
                                trimStatus.textContent = `✓ Trimmed ${result.trimmed} messages, saved ${result.saved} chars`;
                                trimStatus.style.color = 'lightgreen';
                            } else {
                                trimStatus.textContent = 'No messages needed trimming';
                                trimStatus.style.color = '#aaa';
                            }
                        } catch (error) {
                            logger.error('HTML trimming failed', error);
                            trimStatus.textContent = '✗ Error: ' + error.message;
                            trimStatus.style.color = 'red';
                        }

                        setTimeout(() => { trimStatus.textContent = ''; }, 5000);
                    });
                    logger.debug('NemoSettingsUI: Event listener attached to trim button');
                } else {
                    logger.warn('NemoSettingsUI: Failed to find HTML trimming UI elements, skipping event listeners');
                }

                // Tab Overhauls Setting
                const tabOverhaulsToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableTabOverhauls'));
                if (tabOverhaulsToggle) {
                    tabOverhaulsToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableTabOverhauls ?? true;
                    tabOverhaulsToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableTabOverhauls = tabOverhaulsToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                // Wide Navigation Panels Setting
                const widePanelsToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableWidePanels'));
                if (widePanelsToggle) {
                    widePanelsToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.nemoEnableWidePanels ?? true;
                    widePanelsToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].nemoEnableWidePanels = widePanelsToggle.checked;
                        saveSettingsDebounced();
                        this.showRefreshNotification();
                    });
                }

                // Mobile Enhancements Setting
                const mobileEnhancementsToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableMobileEnhancements'));
                if (mobileEnhancementsToggle) {
                    mobileEnhancementsToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableMobileEnhancements ?? true;
                    mobileEnhancementsToggle.addEventListener('change', () => {
                        extension_settings[NEMO_EXTENSION_NAME].enableMobileEnhancements = mobileEnhancementsToggle.checked;
                        saveSettingsDebounced();

                        // Immediately apply/remove the mobile enhancement class
                        if (mobileEnhancementsToggle.checked) {
                            // Re-check if touch device and apply
                            if (window.matchMedia('(pointer: coarse)').matches) {
                                document.body.classList.add('nemo-mobile-enhanced');
                            }
                        } else {
                            document.body.classList.remove('nemo-mobile-enhanced');
                        }

                        logger.info(`Mobile enhancements ${mobileEnhancementsToggle.checked ? 'enabled' : 'disabled'}`);
                    });
                }

                // Pollinations Interceptor Setting
                const pollinationsInterceptorToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnablePollinationsInterceptor'));
                if (pollinationsInterceptorToggle) {
                    pollinationsInterceptorToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.nemoEnablePollinationsInterceptor ?? false;
                    pollinationsInterceptorToggle.addEventListener('change', async () => {
                        extension_settings[NEMO_EXTENSION_NAME].nemoEnablePollinationsInterceptor = pollinationsInterceptorToggle.checked;
                        saveSettingsDebounced();

                        // Immediately initialize/disable the interceptor
                        if (pollinationsInterceptorToggle.checked) {
                            // Initialize the interceptor
                            if (window.PollinationsInterceptor) {
                                window.PollinationsInterceptor.init();
                                logger.info('Pollinations Interceptor enabled and initialized');

                                // Show enable notification
                                const notification = document.createElement('div');
                                notification.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Pollinations Interceptor enabled! Hover over Pollinations images to regenerate.';
                                notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                                document.body.appendChild(notification);
                                setTimeout(() => notification.remove(), 4000);
                            }
                        } else {
                            logger.info('Pollinations Interceptor disabled');

                            // Show disable notification
                            const notification = document.createElement('div');
                            notification.innerHTML = '<i class="fa-solid fa-times"></i> Pollinations Interceptor disabled';
                            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                            document.body.appendChild(notification);
                            setTimeout(() => notification.remove(), 3000);
                        }
                    });
                }

                // Extensions Tab Overhaul Setting
                const extensionsTabOverhaulToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableExtensionsTabOverhaul'));
                extensionsTabOverhaulToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.nemoEnableExtensionsTabOverhaul ?? true;
                extensionsTabOverhaulToggle.addEventListener('change', () => {
                    logger.debug(`Toggle changed to: ${extensionsTabOverhaulToggle.checked}`);
                    extension_settings[NEMO_EXTENSION_NAME].nemoEnableExtensionsTabOverhaul = extensionsTabOverhaulToggle.checked;
                    saveSettingsDebounced();
                    
                    logger.debug('Setting saved. ExtensionsTabOverhaul available', { available: !!window.ExtensionsTabOverhaul });
                    logger.debug('ExtensionsTabOverhaul initialized', { initialized: window.ExtensionsTabOverhaul?.initialized });
                    
                    // Immediately apply the changes without requiring page refresh
                    if (extensionsTabOverhaulToggle.checked) {
                        // Enable the extensions tab overhaul
                        logger.info('Attempting to enable extensions tab overhaul...');
                        if (window.ExtensionsTabOverhaul && !window.ExtensionsTabOverhaul.initialized) {
                            window.ExtensionsTabOverhaul.initialize();
                        }
                        
                        // Show enable notification
                        const enableNotification = document.createElement('div');
                        enableNotification.innerHTML = '<i class="fa-solid fa-check"></i> Extensions Tab Overhaul enabled!';
                        enableNotification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                        document.body.appendChild(enableNotification);
                        setTimeout(() => enableNotification.remove(), 3000);
                    } else {
                        // Disable the extensions tab overhaul
                        logger.debug('Attempting to disable extensions tab overhaul');
                        if (window.ExtensionsTabOverhaul && window.ExtensionsTabOverhaul.initialized) {
                            logger.debug('Calling cleanup function');
                            window.ExtensionsTabOverhaul.cleanup();
                        } else {
                            logger.debug('ExtensionsTabOverhaul not available or not initialized');
                        }
                        
                        // Show disable notification
                        const disableNotification = document.createElement('div');
                        disableNotification.innerHTML = '<i class="fa-solid fa-times"></i> Extensions Tab Overhaul disabled!';
                        disableNotification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                        document.body.appendChild(disableNotification);
                        setTimeout(() => disableNotification.remove(), 3000);
                    }
                });
                
                // Message Theme Setting
                const themeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('nemo-message-theme-select'));
                if (themeSelect) {
                    themeSelect.value = extension_settings[NEMO_EXTENSION_NAME]?.messageTheme || 'default';
                    this.applyMessageTheme(themeSelect.value);

                    themeSelect.addEventListener('change', () => {
                        const selectedTheme = themeSelect.value;
                        extension_settings[NEMO_EXTENSION_NAME].messageTheme = selectedTheme;
                        saveSettingsDebounced();
                        this.applyMessageTheme(selectedTheme);
                    });
                }

                logger.info('NemoSettingsUI: All event listeners attached successfully');
                } catch (error) {
                    logger.error('NemoSettingsUI: Error during initialization', error);
                }
            }
        }, 500);
    },

    applyMessageTheme: function(themeName) {
        document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
        if (themeName && themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
    },

    showRefreshNotification: function() {
        const notification = document.createElement('div');
        notification.innerHTML = '<i class="fa-solid fa-refresh"></i> Page refresh required for changes to take effect.';
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--SmartThemeQuoteColor); color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;';
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
};