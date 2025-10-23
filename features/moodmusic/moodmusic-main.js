// MoodMusic Extension Entry Point for NemoPresetExt
// Spotify mood-based music player for SillyTavern
// Refactored with all Spotify fork improvements + architectural enhancements

import { getContext } from '../../../../../extensions.js';
import { callPopup, eventSource, event_types, generateQuietPrompt, generateRaw, token } from '../../../../../../script.js';

const EXTENSION_NAME = "MoodMusic";
const LOG_PREFIX = "[MoodMusic]";
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/NemoPresetExt/features/moodmusic`;
const PLUGIN_API_BASE = '/api/plugins/moodmusic';

// Configuration Constants
const MUSIC_PRESET_NAME = "Card Emporium Default Preset"; // Updated to use Card Emporium preset
const POLLING_INTERVAL_MS = 10000;
const MOOD_ANALYSIS_TRIGGER_THRESHOLD_MS = 10000;
const HISTORY_FOR_MOOD_ANALYSIS = 8;
const MIN_ANALYSIS_INTERVAL_MS = 3000; // Throttle rapid-fire analyses

/**
 * Custom toastr notification functions with auto-dismiss
 */
function showSuccessToast(message, timeout = 4000) {
    if (window.toastr) window.toastr.success(message, 'MoodMusic', { timeOut: timeout });
}

function showInfoToast(message, timeout = 3000) {
    if (window.toastr) window.toastr.info(message, 'MoodMusic', { timeOut: timeout });
}

function showWarningToast(message, timeout = 5000) {
    if (window.toastr) window.toastr.warning(message, 'MoodMusic', { timeOut: timeout });
}

function showErrorToast(message, timeout = 7000) {
    if (window.toastr) window.toastr.error(message, 'MoodMusic', { timeOut: timeout });
}

/**
 * MoodMusic Extension Main Class - Completely Refactored
 */
export class MoodMusicExtension {
    constructor() {
        // Authentication & Credentials
        this.isInitialized = false;
        this.isAuthenticated = false;
        this.areServerCredentialsSet = false;

        // Playback State
        this.isPollingPlayback = false;
        this.pollingIntervalId = null;
        this.currentlyPlayingTrackUri = null;
        this.lastPlaybackStopTime = 0;

        // Analysis State (with race condition prevention)
        this.isAnalysisInProgress = false;
        this.lastAnalysisTime = 0;
        this.currentRequestId = null;
        this.requestCounter = 0;

        // Preset Management
        this.currentPresetRestorationRequired = false;
        this.originalPresetName = null;
        this.$presetDropdown = null;

        // Extension State
        this.isExtensionActive = true;

        // Settings (with localStorage persistence)
        this.useMusicPreset = false; // false = use current model, true = use Music preset
        this.useLikedSongsFallback = true; // Fallback to Liked Songs when AI suggestion not found

        // Event Listeners (for cleanup)
        this.boundEventListeners = [];
    }

    /**
     * Load MoodMusic CSS dynamically
     */
    loadCSS() {
        const cssPath = 'scripts/extensions/third-party/NemoPresetExt/features/moodmusic/style.css';

        if (document.querySelector(`link[href="${cssPath}"]`)) {
            console.log(`${LOG_PREFIX} CSS already loaded`);
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
        console.log(`${LOG_PREFIX} CSS loaded successfully`);
    }

    /**
     * Initialize the MoodMusic extension
     */
    async initialize() {
        console.log(`${LOG_PREFIX} Initializing...`);

        if (this.isInitialized) {
            console.log(`${LOG_PREFIX} Already initialized`);
            return;
        }

        try {
            // Load CSS first
            this.loadCSS();

            // Load persisted settings
            this.loadSettings();

            // Load settings HTML
            const settingsHtml = await $.get(`${EXTENSION_FOLDER_PATH}/settings.html`);
            $("#extensions_settings").append(settingsHtml);

            // Attach event listeners (stored for cleanup)
            this.attachEventListeners();

            // Initialize UI
            this.updateToggleButtonUI();
            this.updateModelStatusUI();
            this.updateLikedSongsUI();
            this.findAndStorePresetDropdown();

            // Load server status without showing error toasts on first load
            try {
                await this.loadCredentialsStatus();
                await this.checkAuthStatus();
            } catch (error) {
                // Silently handle initial load errors - user can configure via UI
                console.log(`${LOG_PREFIX} Initial auth check: ${error.message}`);
            }

            // Start polling if authenticated
            if (this.isExtensionActive && this.isAuthenticated) {
                if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
                this.pollingIntervalId = setInterval(() => this.pollPlaybackState(), POLLING_INTERVAL_MS);
            }

            this.isInitialized = true;
            console.log(`${LOG_PREFIX} ✅ Initialization complete`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            showErrorToast(`Initialization failed: ${error.message}`);
            $("#extensions_settings").append(`<div class="error" style="color:red;"><b>MoodMusic INIT FAILED:</b> ${error.message}. Check Console.</div>`);
        }
    }

    /**
     * Attach event listeners (stored for cleanup)
     */
    attachEventListeners() {
        const handlers = {
            '#moodmusic-save-creds-button': () => this.saveSpotifyCredentials(),
            '#moodmusic-login-button': () => this.triggerSpotifyLogin(),
            '#moodmusic-toggle-button': () => this.toggleExtensionActiveState(),
            '#moodmusic-switch-model-button': () => this.switchModelMode(),
            '#moodmusic-use-liked-fallback': () => this.saveLikedSongsSettings(),
            '#moodmusic-test-liked-button': () => this.testLikedSongs(),
        };

        const $settings = $('#extensions_settings');
        for (const [selector, handler] of Object.entries(handlers)) {
            $settings.on('click', selector, handler);
            this.boundEventListeners.push({ selector, handler, event: 'click' });
        }

        console.log(`${LOG_PREFIX} Event listeners attached`);
    }

    /**
     * Settings Persistence
     */
    loadSettings() {
        try {
            const useMusicPresetRaw = localStorage.getItem('moodmusic_use_music_preset');
            if (useMusicPresetRaw !== null) {
                this.useMusicPreset = JSON.parse(useMusicPresetRaw) === true;
            }

            const useLikedFallbackRaw = localStorage.getItem('moodmusic_use_liked_fallback');
            if (useLikedFallbackRaw !== null) {
                this.useLikedSongsFallback = JSON.parse(useLikedFallbackRaw) === true;
            }

            console.log(`${LOG_PREFIX} Settings loaded - MusicPreset: ${this.useMusicPreset}, LikedFallback: ${this.useLikedSongsFallback}`);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to load settings:`, error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('moodmusic_use_music_preset', JSON.stringify(this.useMusicPreset));
            localStorage.setItem('moodmusic_use_liked_fallback', JSON.stringify(this.useLikedSongsFallback));
            console.log(`${LOG_PREFIX} Settings saved`);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to save settings:`, error);
        }
    }

    /**
     * Model Mode Switching
     */
    switchModelMode() {
        this.useMusicPreset = !this.useMusicPreset;
        this.saveSettings();
        this.updateModelStatusUI();

        const mode = this.useMusicPreset ? 'Music preset model' : 'Current main model';
        showInfoToast(`Model source → ${mode}`);
        console.log(`${LOG_PREFIX} Model source switched to: ${mode}`);
    }

    updateModelStatusUI() {
        const statusText = this.useMusicPreset ? 'Music preset model' : 'Current main model';
        $('#moodmusic-model-status').text(statusText);
    }

    /**
     * Liked Songs Fallback Settings
     */
    saveLikedSongsSettings() {
        this.useLikedSongsFallback = $('#moodmusic-use-liked-fallback').prop('checked');
        this.saveSettings();
        console.log(`${LOG_PREFIX} Liked Songs fallback: ${this.useLikedSongsFallback}`);
    }

    updateLikedSongsUI() {
        $('#moodmusic-use-liked-fallback').prop('checked', this.useLikedSongsFallback);
    }

    async testLikedSongs() {
        if (!this.isAuthenticated) {
            showErrorToast("Cannot test - not logged into Spotify");
            return;
        }

        console.log(`${LOG_PREFIX} Testing Liked Songs playback`);
        showInfoToast("Testing your Liked Songs...");

        try {
            const success = await this.requestPlayLikedSongs();
            if (success) {
                showSuccessToast("Successfully started playing your Liked Songs!");
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Test Liked Songs failed:`, error);
            showErrorToast(`Test failed: ${error.message}`);
        }
    }

    /**
     * Helper to get API headers with CSRF token
     */
    getApiHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token || $('body').data('csrf-token'),
        };
    }

    /**
     * UI Update Functions
     */
    updateCredentialsStatusUI(status) {
        const credsStatusText = $('#moodmusic-creds-status');
        const loginButton = $('#moodmusic-login-button');
        if (!credsStatusText.length) {
            console.warn(`${LOG_PREFIX} Creds status UI not found.`);
            return;
        }

        if (status && status.clientIdSet && status.clientSecretSet) {
            credsStatusText.text('Saved ✓').css('color', 'lightgreen');
            this.areServerCredentialsSet = true;
            loginButton.prop('disabled', false).attr('title', 'Login to Spotify');
        } else {
            let msg = 'Not Set';
            if (status && status.clientIdSet && !status.clientSecretSet) msg = 'Client Secret Missing';
            else if (status && !status.clientIdSet && status.clientSecretSet) msg = 'Client ID Missing';
            credsStatusText.text(msg).css('color', 'coral');
            this.areServerCredentialsSet = false;
            loginButton.prop('disabled', true).attr('title', 'Spotify credentials not set on server.');
        }
        this.updateAuthStatusUI(this.isAuthenticated, this.areServerCredentialsSet);
    }

    updateAuthStatusUI(loggedIn, serverCredsAreSet = this.areServerCredentialsSet) {
        const statusText = $('#moodmusic-status');
        const loginButton = $('#moodmusic-login-button');
        if (!statusText.length || !loginButton.length) {
            console.warn(`${LOG_PREFIX} UI elements not found.`);
            return;
        }

        this.isAuthenticated = loggedIn;

        if (!serverCredsAreSet) {
            statusText.text('Configure Credentials').css('color', 'orange');
            loginButton.hide();
        } else if (loggedIn) {
            statusText.text('Logged In').css('color', 'lightgreen');
            loginButton.hide();
        } else {
            statusText.text('Not Logged In').css('color', 'coral');
            loginButton.show().prop('disabled', false);
        }

        const previousIsAuthenticated = window.moodMusicPreviousIsAuthenticated || false;
        window.moodMusicPreviousIsAuthenticated = loggedIn;

        if (previousIsAuthenticated !== loggedIn) {
            console.log(`${LOG_PREFIX} Auth state changed: ${previousIsAuthenticated} → ${loggedIn}`);
            if (!loggedIn && this.isPollingPlayback) {
                this.stopPlaybackPolling();
            } else if (loggedIn && !this.isPollingPlayback && this.isInitialized && this.isExtensionActive && !this.pollingIntervalId && this.areServerCredentialsSet) {
                console.log(`${LOG_PREFIX} Starting polling after login`);
                if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
                this.pollingIntervalId = setInterval(() => this.pollPlaybackState(), POLLING_INTERVAL_MS);
            }
        }
        this.isAuthenticated = loggedIn;
    }

    updateToggleButtonUI() {
        const $button = $('#moodmusic-toggle-button');
        if (!$button.length) return;
        if (this.isExtensionActive) {
            $button.html('<i class="fa-solid fa-pause"></i> Pause Music').removeClass('success_button').addClass('menu_button');
        } else {
            $button.html('<i class="fa-solid fa-play"></i> Resume Music').removeClass('menu_button').addClass('success_button');
        }
    }

    /**
     * API Calls
     */
    async loadCredentialsStatus() {
        try {
            const response = await fetch(`${PLUGIN_API_BASE}/config`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.updateCredentialsStatusUI(data);
            console.log(`${LOG_PREFIX} Credential status loaded:`, data);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to load credential status:`, error);
            this.updateCredentialsStatusUI({ clientIdSet: false, clientSecretSet: false });
            showErrorToast("Failed to load credential status");
        }
    }

    async saveSpotifyCredentials() {
        const clientId = $('#moodmusic-client-id').val();
        const clientSecret = $('#moodmusic-client-secret').val();

        if (!clientId || !clientSecret) {
            showWarningToast("Client ID and Client Secret are required");
            return;
        }

        try {
            const response = await fetch(`${PLUGIN_API_BASE}/config`, {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({ clientId, clientSecret }),
            });

            if (!response.ok) {
                let errorText = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    if (errorJson && errorJson.message) errorText = errorJson.message;
                } catch (e) {
                    if (response.status === 403) {
                        errorText = 'Forbidden. CSRF token invalid. Please refresh.';
                    }
                }
                throw new Error(errorText);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Operation failed');
            }

            showSuccessToast("Spotify credentials saved!");
            console.log(`${LOG_PREFIX} Credentials saved`);
            $('#moodmusic-client-secret').val('');
            await this.loadCredentialsStatus();
            await this.checkAuthStatus();
        } catch (error) {
            console.error(`${LOG_PREFIX} Error saving credentials:`, error);
            showErrorToast(`Failed to save: ${error.message}`);
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch(`${PLUGIN_API_BASE}/auth/status`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.areServerCredentialsSet = data.credentialsSet;
            this.updateAuthStatusUI(data.loggedIn, data.credentialsSet);
        } catch (error) {
            console.error(`${LOG_PREFIX} checkAuthStatus failed:`, error);
            this.updateAuthStatusUI(false, this.areServerCredentialsSet);
        }
    }

    async triggerSpotifyLogin() {
        if (!this.areServerCredentialsSet) {
            showErrorToast("Cannot login: Spotify credentials not configured");
            return;
        }
        try {
            const loginUrl = `${PLUGIN_API_BASE}/auth/login`;
            const popupWidth = 600, popupHeight = 700;
            const left = (window.screen.width / 2) - (popupWidth / 2);
            const top = (window.screen.height / 2) - (popupHeight / 2);
            const popup = window.open(loginUrl, 'SpotifyLogin', `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes`);

            const checkPopupClosed = setInterval(async () => {
                if (!popup || popup.closed) {
                    clearInterval(checkPopupClosed);
                    console.log(`${LOG_PREFIX} Login popup closed. Re-checking auth...`);
                    setTimeout(() => this.checkAuthStatus(), 1500);
                }
            }, 1000);
        } catch (error) {
            console.error(`${LOG_PREFIX} Login error:`, error);
            showErrorToast(`Login error: ${error.message}`);
        }
    }

    /**
     * Playback Management
     */
    async getPlaybackState() {
        if (!this.isAuthenticated) return null;
        try {
            const response = await fetch(`${PLUGIN_API_BASE}/playback/state`, { method: 'GET' });
            if (response.status === 401) {
                console.warn(`${LOG_PREFIX} Got 401. Re-checking auth.`);
                await this.checkAuthStatus();
                return null;
            }
            if (!response.ok) {
                console.error(`${LOG_PREFIX} HTTP error getting playback: ${response.status}`);
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error(`${LOG_PREFIX} Network error getting playback:`, error);
            return null;
        }
    }

    startPlaybackPolling(trackUri) {
        if (!this.isExtensionActive) {
            console.log(`${LOG_PREFIX} Not starting: extension paused.`);
            return;
        }
        if (this.isPollingPlayback) return;
        if (!this.isAuthenticated || !trackUri) return;
        console.log(`${LOG_PREFIX} Starting polling for: ${trackUri}`);
        this.currentlyPlayingTrackUri = trackUri;
        this.isPollingPlayback = true;
    }

    stopPlaybackPolling() {
        if (!this.isPollingPlayback) return;
        console.log(`${LOG_PREFIX} Stopping polling`);
        this.isPollingPlayback = false;
        this.currentlyPlayingTrackUri = null;
    }

    async pollPlaybackState() {
        if (!this.isExtensionActive || !this.isAuthenticated) return;

        const state = await this.getPlaybackState();
        if (!state) {
            if (this.isPollingPlayback) {
                console.warn(`${LOG_PREFIX} Polling stopped due to state error.`);
                this.stopPlaybackPolling();
                this.lastPlaybackStopTime = Date.now();
                if (this.currentPresetRestorationRequired) await this.restoreOriginalPreset();
            }
            return;
        }

        const isTargetTrackActive = this.isPollingPlayback && state.is_playing && state.item?.uri === this.currentlyPlayingTrackUri;

        if (isTargetTrackActive) {
            this.lastPlaybackStopTime = 0;
        } else {
            if (this.isPollingPlayback) {
                console.log(`${LOG_PREFIX} Target track stopped`);
                this.stopPlaybackPolling();
                this.lastPlaybackStopTime = Date.now();
                await this.restoreOriginalPreset();
                setTimeout(() => {
                    if (this.isExtensionActive && !this.isAnalysisInProgress && this.isAuthenticated) {
                        this.triggerMoodAnalysisAndPlay();
                    }
                }, 500);
            } else if (!state.is_playing) {
                if (this.lastPlaybackStopTime === 0) this.lastPlaybackStopTime = Date.now();
                const timeSinceStop = Date.now() - this.lastPlaybackStopTime;
                if (timeSinceStop >= MOOD_ANALYSIS_TRIGGER_THRESHOLD_MS && !this.isAnalysisInProgress) {
                    console.log(`${LOG_PREFIX} Inactivity threshold passed. Triggering mood analysis.`);
                    this.lastPlaybackStopTime = Date.now();
                    this.triggerMoodAnalysisAndPlay();
                }
            } else {
                this.lastPlaybackStopTime = Date.now();
            }
        }
    }

    /**
     * Preset Management
     */
    findAndStorePresetDropdown() {
        const dropdownId = '#settings_preset_openai';
        const $foundDropdown = $(dropdownId);
        if ($foundDropdown.length) {
            this.$presetDropdown = $foundDropdown;
            console.log(`${LOG_PREFIX} Preset dropdown found`);
        } else {
            console.error(`${LOG_PREFIX} Could NOT find preset dropdown: ${dropdownId}`);
        }
    }

    getCurrentPresetNameFromUi() {
        if (!this.$presetDropdown || !this.$presetDropdown.length) this.findAndStorePresetDropdown();
        if (!this.$presetDropdown || !this.$presetDropdown.length) {
            console.error(`${LOG_PREFIX} Dropdown invalid. Cannot get preset.`);
            return null;
        }
        return this.$presetDropdown.find('option:selected').text().trim();
    }

    async setPresetViaUi(presetName) {
        if (!this.$presetDropdown || !this.$presetDropdown.length) {
            console.error(`${LOG_PREFIX} Cannot find preset dropdown. Aborting switch.`);
            return false;
        }
        const $targetOption = this.$presetDropdown.find('option').filter(function() {
            return $(this).text().trim() === presetName;
        });

        if ($targetOption.length) {
            const targetValue = $targetOption.val();
            if (this.$presetDropdown.val() === targetValue) {
                console.log(`${LOG_PREFIX} Preset "${presetName}" already selected.`);
                return true;
            }
            this.$presetDropdown.val(targetValue).trigger('change');
            await new Promise(resolve => setTimeout(resolve, 200));
            if (this.$presetDropdown.val() === targetValue) {
                console.log(`${LOG_PREFIX} Switched to preset "${presetName}".`);
                return true;
            } else {
                console.error(`${LOG_PREFIX} Verification failed after setting "${presetName}".`);
                return false;
            }
        } else {
            console.error(`${LOG_PREFIX} Could not find preset: "${presetName}". Available:`,
                this.$presetDropdown.find('option').map((i, el) => $(el).text().trim()).get());
            return false;
        }
    }

    async restoreOriginalPreset() {
        if (this.currentPresetRestorationRequired && this.originalPresetName) {
            console.log(`${LOG_PREFIX} Restoring preset: ${this.originalPresetName}`);
            const restored = await this.setPresetViaUi(this.originalPresetName);
            if (!restored) {
                console.error(`${LOG_PREFIX} FAILED TO RESTORE "${this.originalPresetName}".`);
                showErrorToast("Critical! Failed to restore preset");
            }
        } else if (this.currentPresetRestorationRequired && !this.originalPresetName) {
            console.error(`${LOG_PREFIX} Restoration required but original preset unknown.`);
            showWarningToast("Switched preset but original unknown");
        }
        this.currentPresetRestorationRequired = false;
        this.originalPresetName = null;
    }

    /**
     * AI Interaction with Card Emporium Preset
     */
    async getMusicSuggestionFromAI(chatHistorySnippet) {
        console.log(`${LOG_PREFIX} Requesting music suggestion from AI...`);

        // Store original preset
        this.originalPresetName = this.getCurrentPresetNameFromUi();
        if (!this.originalPresetName) {
            console.error(`${LOG_PREFIX} Could not determine original preset.`);
            showErrorToast("Cannot determine current preset");
            return null;
        }

        // Switch to Card Emporium preset
        const switched = await this.setPresetViaUi(MUSIC_PRESET_NAME);
        if (!switched) {
            console.error(`${LOG_PREFIX} Failed to switch to "${MUSIC_PRESET_NAME}".`);
            showErrorToast(`Cannot switch to ${MUSIC_PRESET_NAME} preset`);
            return null;
        }
        this.currentPresetRestorationRequired = true;

        try {
            console.log(`${LOG_PREFIX} Using Card Emporium preset for generation...`);

            // Use generateQuietPrompt with the chat history
            const aiResponseText = await generateQuietPrompt(chatHistorySnippet, false, true, { source: 'moodmusic' });

            if (!aiResponseText || typeof aiResponseText !== 'string' || aiResponseText.trim() === '') {
                throw new Error("AI returned empty response");
            }

            console.log(`${LOG_PREFIX} AI response received:`, aiResponseText.substring(0, 200));
            return aiResponseText.trim();
        } catch (error) {
            console.error(`${LOG_PREFIX} AI suggestion error:`, error);
            showErrorToast(`AI suggestion failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Parse music from AI response with multiple fallback patterns
     */
    parseMusicFromAiResponse(aiResponseText) {
        if (!aiResponseText || typeof aiResponseText !== 'string') {
            console.error(`${LOG_PREFIX} Invalid AI response: empty or not a string`);
            return null;
        }

        console.log(`${LOG_PREFIX} Parsing AI response...`);

        // Multiple parsing patterns for robustness
        let titleMatch = aiResponseText.match(/Title:\s*(.*?)(?:\n|$)/i);
        let artistMatch = aiResponseText.match(/Artist:\s*(.*?)(?:\n|$)/i);

        // Alternative patterns if the first ones don't work
        if (!titleMatch) {
            titleMatch = aiResponseText.match(/Song:\s*(.*?)(?:\n|$)/i) ||
                        aiResponseText.match(/Track:\s*(.*?)(?:\n|$)/i) ||
                        aiResponseText.match(/"([^"]+)"\s*by\s*/i);
        }

        if (!artistMatch && titleMatch) {
            artistMatch = aiResponseText.match(/by\s+(.*?)(?:\n|$)/i);
        }

        const title = titleMatch ? titleMatch[1].trim().replace(/["""]/g, '') : null;
        const artist = artistMatch ? artistMatch[1].trim().replace(/["""]/g, '') : null;

        if (title) {
            const result = { title, artist: artist || 'Unknown Artist' };
            console.log(`${LOG_PREFIX} Successfully parsed:`, result);
            return result;
        }

        console.warn(`${LOG_PREFIX} Could not parse song info from: "${aiResponseText}"`);
        showWarningToast("Could not parse song from AI response");
        return null;
    }

    /**
     * Request to play Liked Songs (fallback feature)
     */
    async requestPlayLikedSongs() {
        if (!this.isAuthenticated) {
            showErrorToast("Cannot play - not logged into Spotify");
            return false;
        }

        console.log(`${LOG_PREFIX} Requesting Liked Songs playback...`);

        try {
            const response = await fetch(`${PLUGIN_API_BASE}/play/liked`, {
                method: 'POST',
                headers: this.getApiHeaders(),
            });

            const data = await response.json();
            if (!response.ok) {
                let errorMsg = data.message || `Failed to play liked songs (HTTP ${response.status})`;
                showErrorToast(errorMsg);
                if (data.needsLogin) await this.checkAuthStatus();
                return false;
            }

            console.log(`${LOG_PREFIX} Successfully started playing Liked Songs: ${data.message}`);
            if (data.success && data.trackUri) this.startPlaybackPolling(data.trackUri);
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Liked Songs request error:`, error);
            showErrorToast(`Liked Songs playback failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Request to play specific song (with Liked Songs fallback)
     */
    async requestPlaySong(suggestion, isOriginalRequest = true) {
        if (!this.isAuthenticated) {
            showErrorToast("Cannot play - not logged into Spotify");
            return false;
        }
        if (!suggestion || !suggestion.title) {
            console.error(`${LOG_PREFIX} Invalid suggestion.`);
            return false;
        }

        try {
            const response = await fetch(`${PLUGIN_API_BASE}/play`, {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({ suggestion: suggestion })
            });

            const data = await response.json();
            if (!response.ok) {
                let errorMsg = data.message || `Play request failed (HTTP ${response.status})`;

                // Check if song wasn't found and we should use liked songs fallback
                if (isOriginalRequest && this.useLikedSongsFallback && (
                    data.message?.includes('not found') ||
                    data.message?.includes('No tracks found') ||
                    data.message?.includes('Could not find') ||
                    response.status === 404
                )) {
                    console.log(`${LOG_PREFIX} Original song not found, trying Liked Songs fallback`);
                    showWarningToast(`"${suggestion.artist} - ${suggestion.title}" not found, playing from your Liked Songs`);
                    return await this.requestPlayLikedSongs();
                }

                showErrorToast(errorMsg);
                if (data.needsLogin) await this.checkAuthStatus();
                if (data.needsConfiguration) await this.loadCredentialsStatus();
                return false;
            }

            console.log(`${LOG_PREFIX} Play success: ${data.message}`);
            if (data.success && data.trackUri) this.startPlaybackPolling(data.trackUri);
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Play request error:`, error);
            showErrorToast(`Play request failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Trigger mood analysis and play - with race condition prevention and throttling
     */
    async triggerMoodAnalysisAndPlay(bypassActiveCheck = false) {
        // Check basic conditions
        if (this.isAnalysisInProgress || (!bypassActiveCheck && !this.isExtensionActive) || !this.isAuthenticated) {
            console.log(`${LOG_PREFIX} Analysis aborted (InProgress: ${this.isAnalysisInProgress}, Active: ${this.isExtensionActive}, Auth: ${this.isAuthenticated})`);
            return true;
        }

        // Throttle rapid-fire analyses
        const now = Date.now();
        if (now - this.lastAnalysisTime < MIN_ANALYSIS_INTERVAL_MS) {
            console.log(`${LOG_PREFIX} Analysis throttled (${now - this.lastAnalysisTime}ms < ${MIN_ANALYSIS_INTERVAL_MS}ms)`);
            return true;
        }

        // Generate unique request ID for race condition prevention
        const requestId = ++this.requestCounter;
        console.log(`${LOG_PREFIX} [Request-${requestId}] Starting mood analysis...`);

        // Atomic check for exclusive access
        if (this.isAnalysisInProgress || this.currentRequestId !== null) {
            console.log(`${LOG_PREFIX} [Request-${requestId}] BLOCKED - Analysis already in progress`);
            return true;
        }

        // Set both flags atomically
        this.isAnalysisInProgress = true;
        this.currentRequestId = requestId;
        this.lastAnalysisTime = now;
        this.currentPresetRestorationRequired = false;
        this.originalPresetName = null;

        try {
            const context = getContext();
            if (!context?.chat?.length) {
                console.warn(`${LOG_PREFIX} No chat history available.`);
                showWarningToast("No chat history available for mood analysis");
                return false;
            }

            console.log(`${LOG_PREFIX} Analyzing last ${HISTORY_FOR_MOOD_ANALYSIS} messages...`);
            const history = context.chat.slice(-HISTORY_FOR_MOOD_ANALYSIS);

            // Deduplicate messages
            const processedHistory = [];
            const seenMessages = new Set();

            for (const msg of history) {
                const messageKey = `${msg.is_user ? 'User' : 'Character'}:${msg.mes?.substring(0, 100)}`;
                if (!seenMessages.has(messageKey) && msg.mes?.trim()) {
                    seenMessages.add(messageKey);
                    processedHistory.push(msg);
                }
            }

            const chatHistorySnippet = processedHistory.map(msg =>
                `${msg.is_user ? 'User' : 'Character'}: ${msg.mes.trim()}`
            ).join('\n\n');

            console.log(`${LOG_PREFIX} Chat snippet: ${processedHistory.length} messages, ${chatHistorySnippet.length} chars`);

            const aiResponseText = await this.getMusicSuggestionFromAI(chatHistorySnippet);
            if (aiResponseText) {
                const suggestion = this.parseMusicFromAiResponse(aiResponseText);
                if (suggestion) {
                    console.log(`${LOG_PREFIX} Parsed suggestion, requesting play:`, suggestion);
                    await this.requestPlaySong(suggestion, true);
                    return true;
                } else {
                    console.warn(`${LOG_PREFIX} Could not parse suggestion from AI response`);

                    // Fallback to Liked Songs if enabled
                    if (this.useLikedSongsFallback) {
                        showInfoToast("Couldn't parse song from AI, playing your Liked Songs");
                        await this.requestPlayLikedSongs();
                        return true;
                    }
                    return false;
                }
            } else {
                console.error(`${LOG_PREFIX} Failed to get valid AI suggestion`);
                return false;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Analysis error:`, error);
            showErrorToast(`Mood analysis failed: ${error.message}`);
            return false;
        } finally {
            await this.restoreOriginalPreset();
            this.isAnalysisInProgress = false;
            this.currentRequestId = null;
            console.log(`${LOG_PREFIX} [Request-${requestId}] Analysis complete.`);
        }
    }

    /**
     * Toggle extension active state
     */
    toggleExtensionActiveState() {
        this.isExtensionActive = !this.isExtensionActive;
        this.updateToggleButtonUI();

        if (this.isExtensionActive) {
            console.log(`${LOG_PREFIX} Extension Resumed.`);
            showInfoToast("MoodMusic resumed");
            if (!this.pollingIntervalId && this.isAuthenticated) {
                this.pollingIntervalId = setInterval(() => this.pollPlaybackState(), POLLING_INTERVAL_MS);
                this.pollPlaybackState();
            }
        } else {
            console.log(`${LOG_PREFIX} Extension Paused.`);
            showInfoToast("MoodMusic paused");
            this.stopPlaybackPolling();
            if (this.pollingIntervalId) {
                clearInterval(this.pollingIntervalId);
                this.pollingIntervalId = null;
            }
            if (this.isAnalysisInProgress) this.restoreOriginalPreset();
            this.isAnalysisInProgress = false;
            this.currentRequestId = null;
        }
    }

    /**
     * Cleanup - called when extension is disabled or ST is closed
     */
    shutdown() {
        console.log(`${LOG_PREFIX} Shutting down...`);

        // Stop polling
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }

        // Restore preset if needed
        if (this.currentPresetRestorationRequired) {
            this.restoreOriginalPreset();
        }

        // Remove event listeners
        const $settings = $('#extensions_settings');
        for (const listener of this.boundEventListeners) {
            $settings.off(listener.event, listener.selector, listener.handler);
        }
        this.boundEventListeners = [];

        this.isInitialized = false;
        console.log(`${LOG_PREFIX} ✅ Shutdown complete`);
    }
}
