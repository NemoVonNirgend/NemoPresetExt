/**
 * Animated Backgrounds Module for NemoPresetExt
 * Enhanced background system supporting webm, gif, mp4, and YouTube URLs
 */

import logger from './logger.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX } from './utils.js';

export class AnimatedBackgroundsModule {
    constructor() {
        this.EXTENSION_NAME = 'Animated Backgrounds';
        this.EXTENSION_ID = 'animated-backgrounds';
        this.isInitialized = false;
        
        // Enhanced media types
        this.MEDIA_TYPES = {
            VIDEO: 'video',
            ANIMATED_IMAGE: 'animated_image', 
            STATIC_IMAGE: 'image',
            YOUTUBE: 'youtube',
            EMBED: 'embed'
        };

        // Supported file extensions
        this.EXTENSIONS = {
            video: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'ogv'],
            animated_image: ['gif', 'webp'],
            image: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'svg', 'ico']
        };

        this.defaultSettings = {
            enabled: true,
            enableLoop: true,
            enableAutoplay: true,
            enableMute: true,
            videoVolume: 0.1,
            enablePreload: true,
            fallbackToThumbnail: true,
            youtubeQuality: 'hd720',
            enableParticles: false,
            showControls: false,
            backgroundFitting: 'cover'
        };

        this.currentBackground = null;
        this.backgroundContainer = null;
    }

    /**
     * Initialize the animated backgrounds module
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn(`${LOG_PREFIX} Animated Backgrounds already initialized`);
            return;
        }

        try {
            logger.info(`${LOG_PREFIX} Initializing Animated Backgrounds Module...`);
            
            this.ensureSettings();
            this.createBackgroundContainer();
            this.hookIntoBackgroundSystem();
            this.setupEventListeners();
            this.loadCSS();
            
            this.isInitialized = true;
            logger.info(`${LOG_PREFIX} Animated Backgrounds Module initialized successfully`);
        } catch (error) {
            logger.error(`${LOG_PREFIX} Failed to initialize Animated Backgrounds Module:`, error);
        }
    }

    /**
     * Ensure settings namespace exists
     */
    ensureSettings() {
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        if (!extension_settings.NemoPresetExt.animatedBackgrounds) {
            extension_settings.NemoPresetExt.animatedBackgrounds = { ...this.defaultSettings };
        }
        
        // Merge with defaults for any missing settings
        const settings = extension_settings.NemoPresetExt.animatedBackgrounds;
        extension_settings.NemoPresetExt.animatedBackgrounds = { ...this.defaultSettings, ...settings };
    }

    /**
     * Get current settings
     */
    getSettings() {
        return extension_settings.NemoPresetExt.animatedBackgrounds || this.defaultSettings;
    }

    /**
     * Save settings
     */
    saveSettings() {
        // Settings are automatically saved by SillyTavern's extension system
        logger.debug(`${LOG_PREFIX} Animated backgrounds settings saved`);
    }

    /**
     * Load CSS dynamically
     */
    loadCSS() {
        const existingStyle = document.getElementById('animated-backgrounds-css');
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('link');
        style.id = 'animated-backgrounds-css';
        style.rel = 'stylesheet';
        style.type = 'text/css';
        style.href = 'scripts/extensions/third-party/NemoPresetExt/animated-backgrounds.css';
        document.head.appendChild(style);
    }

    /**
     * Enhanced media type detection
     */
    getEnhancedMediaType(fileName) {
        if (!fileName) return this.MEDIA_TYPES.STATIC_IMAGE;
        
        // Handle URLs
        if (fileName.startsWith('http')) {
            if (this.isYouTubeUrl(fileName)) {
                return this.MEDIA_TYPES.YOUTUBE;
            }
            // For other URLs, try to detect by extension in URL
            try {
                const urlPath = new URL(fileName).pathname;
                const extension = urlPath.split('.').pop()?.toLowerCase();
                if (extension) {
                    return this.getMediaTypeByExtension(extension);
                }
            } catch (e) {
                // Invalid URL, treat as static image
            }
            return this.MEDIA_TYPES.STATIC_IMAGE;
        }
        
        // Handle local files
        const extension = fileName.split('.').pop()?.toLowerCase();
        return this.getMediaTypeByExtension(extension);
    }

    /**
     * Get media type by file extension
     */
    getMediaTypeByExtension(extension) {
        for (const [type, exts] of Object.entries(this.EXTENSIONS)) {
            if (exts.includes(extension)) {
                return type === 'animated_image' ? this.MEDIA_TYPES.ANIMATED_IMAGE : 
                       type === 'video' ? this.MEDIA_TYPES.VIDEO : 
                       this.MEDIA_TYPES.STATIC_IMAGE;
            }
        }
        return this.MEDIA_TYPES.STATIC_IMAGE;
    }

    /**
     * Check if URL is a YouTube URL
     */
    isYouTubeUrl(url) {
        return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(url);
    }

    /**
     * Extract YouTube video ID from URL
     */
    getYouTubeVideoId(url) {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        return match ? match[1] : null;
    }

    /**
     * Create YouTube embed URL
     */
    createYouTubeEmbedUrl(videoId) {
        const settings = this.getSettings();
        const params = new URLSearchParams({
            autoplay: settings.enableAutoplay ? '1' : '0',
            loop: settings.enableLoop ? '1' : '0',
            mute: settings.enableMute ? '1' : '0',
            playlist: settings.enableLoop ? videoId : '',
            controls: settings.showControls ? '1' : '0',
            showinfo: '0',
            rel: '0',
            modestbranding: '1',
            iv_load_policy: '3',
            fs: '0',
            disablekb: '1'
        });
        
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }

    /**
     * Create enhanced background container
     */
    createBackgroundContainer() {
        let container = document.getElementById('enhanced-background-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'enhanced-background-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
                overflow: hidden;
                pointer-events: none;
            `;
            
            // Insert before the original bg elements
            const bgCustom = document.getElementById('bg_custom');
            if (bgCustom) {
                bgCustom.parentNode.insertBefore(container, bgCustom);
            } else {
                document.body.appendChild(container);
            }
        }
        this.backgroundContainer = container;
        return container;
    }

    /**
     * Set animated background
     */
    setAnimatedBackground(source, mediaType) {
        const settings = this.getSettings();
        
        if (!settings.enabled) {
            logger.debug(`${LOG_PREFIX} Animated backgrounds disabled, skipping`);
            return;
        }

        const container = this.createBackgroundContainer();
        
        // Clear existing content
        container.innerHTML = '';
        container.className = 'bg-loading';
        
        this.currentBackground = { source, mediaType };
        
        switch (mediaType) {
            case this.MEDIA_TYPES.VIDEO:
                this.setVideoBackground(container, source);
                break;
                
            case this.MEDIA_TYPES.YOUTUBE:
                this.setYouTubeBackground(container, source);
                break;
                
            case this.MEDIA_TYPES.ANIMATED_IMAGE:
                this.setAnimatedImageBackground(container, source);
                break;
                
            case this.MEDIA_TYPES.STATIC_IMAGE:
            default:
                this.setImageBackground(container, source);
                break;
        }

        // Remove loading class after a short delay
        setTimeout(() => {
            container.classList.remove('bg-loading');
        }, 1000);
    }

    /**
     * Set video background
     */
    setVideoBackground(container, source) {
        const settings = this.getSettings();
        const video = document.createElement('video');
        
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: ${settings.backgroundFitting};
            position: absolute;
            top: 0;
            left: 0;
        `;
        
        video.src = source;
        video.loop = settings.enableLoop;
        video.muted = settings.enableMute;
        video.volume = settings.enableMute ? 0 : settings.videoVolume;
        video.preload = settings.enablePreload ? 'auto' : 'metadata';
        
        if (settings.enableAutoplay) {
            video.autoplay = true;
        }
        
        // Error handling
        video.onerror = () => {
            logger.error(`${LOG_PREFIX} Failed to load video background:`, source);
            if (settings.fallbackToThumbnail) {
                this.setImageBackground(container, source);
            }
        };

        video.onloadstart = () => {
            logger.debug(`${LOG_PREFIX} Video background loading started:`, source);
        };

        video.onloadeddata = () => {
            logger.debug(`${LOG_PREFIX} Video background loaded:`, source);
            container.classList.remove('bg-loading');
        };
        
        container.appendChild(video);
    }

    /**
     * Set YouTube background
     */
    setYouTubeBackground(container, url) {
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) {
            logger.error(`${LOG_PREFIX} Invalid YouTube URL:`, url);
            return;
        }
        
        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            border: none;
            pointer-events: none;
        `;
        
        iframe.src = this.createYouTubeEmbedUrl(videoId);
        iframe.allow = 'autoplay; encrypted-media';
        iframe.loading = 'lazy';
        
        iframe.onload = () => {
            logger.debug(`${LOG_PREFIX} YouTube background loaded:`, url);
            container.classList.remove('bg-loading');
        };
        
        container.appendChild(iframe);
    }

    /**
     * Set animated image background
     */
    setAnimatedImageBackground(container, source) {
        const settings = this.getSettings();
        const img = document.createElement('img');
        
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: ${settings.backgroundFitting};
            position: absolute;
            top: 0;
            left: 0;
        `;
        
        img.src = source;
        img.alt = 'Animated Background';
        
        img.onerror = () => {
            logger.error(`${LOG_PREFIX} Failed to load animated image background:`, source);
        };

        img.onload = () => {
            logger.debug(`${LOG_PREFIX} Animated image background loaded:`, source);
            container.classList.remove('bg-loading');
        };
        
        container.appendChild(img);
    }

    /**
     * Set static image background
     */
    setImageBackground(container, source) {
        const settings = this.getSettings();
        container.style.backgroundImage = `url("${source}")`;
        container.style.backgroundSize = settings.backgroundFitting;
        container.style.backgroundPosition = 'center';
        container.style.backgroundRepeat = 'no-repeat';
        container.classList.remove('bg-loading');
        
        logger.debug(`${LOG_PREFIX} Static image background set:`, source);
    }

    /**
     * Hook into SillyTavern's background system
     */
    hookIntoBackgroundSystem() {
        // Store original functions
        const originalSetBackground = window.setBackground;
        const originalGetMediaType = window.getMediaType;
        
        // Override getMediaType if it exists
        if (originalGetMediaType) {
            window.getMediaType = (fileName) => {
                const enhancedType = this.getEnhancedMediaType(fileName);
                // Map our enhanced types back to SillyTavern's expected types
                switch (enhancedType) {
                    case this.MEDIA_TYPES.VIDEO:
                        return 'video';
                    case this.MEDIA_TYPES.YOUTUBE:
                        return 'embed';
                    case this.MEDIA_TYPES.ANIMATED_IMAGE:
                        return 'image'; // SillyTavern treats these as images
                    default:
                        return 'image';
                }
            };
        }

        // Override setBackground if it exists
        if (originalSetBackground) {
            window.setBackground = (bg, url, mediaType) => {
                // Check if this is a stored video blob
                let resolvedUrl = url || bg;
                if (bg && bg.startsWith('video_')) {
                    const videoData = this.getVideoBlob(bg);
                    if (videoData) {
                        resolvedUrl = videoData.blobUrl;
                        mediaType = this.MEDIA_TYPES.VIDEO;
                        logger.debug(`${LOG_PREFIX} Using stored video blob for:`, bg);
                    }
                }

                // Use enhanced media type detection if not provided
                if (!mediaType) {
                    mediaType = this.getEnhancedMediaType(resolvedUrl || bg);
                }
                
                // Use our enhanced background system for supported types
                if ([this.MEDIA_TYPES.VIDEO, this.MEDIA_TYPES.YOUTUBE, this.MEDIA_TYPES.ANIMATED_IMAGE].includes(mediaType)) {
                    this.setAnimatedBackground(resolvedUrl, mediaType);
                }
                
                // Still call original for compatibility
                try {
                    const compatType = mediaType === this.MEDIA_TYPES.YOUTUBE ? 'embed' : 
                                     mediaType === this.MEDIA_TYPES.ANIMATED_IMAGE ? 'image' : 
                                     mediaType;
                    originalSetBackground.call(this, bg, resolvedUrl, compatType);
                } catch (error) {
                    logger.error(`${LOG_PREFIX} Error calling original setBackground:`, error);
                }
            };

            logger.debug(`${LOG_PREFIX} Successfully hooked into background system`);
        } else {
            logger.warn(`${LOG_PREFIX} Could not find original setBackground function to hook into`);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for clipboard paste for YouTube URLs
        document.addEventListener('paste', (e) => {
            if (document.activeElement && document.activeElement.id === 'add_bg_button') {
                const clipboardData = e.clipboardData || window.clipboardData;
                const pastedData = clipboardData.getData('Text');
                
                if (this.isYouTubeUrl(pastedData)) {
                    e.preventDefault();
                    this.handleYouTubePaste(pastedData);
                }
            }
        });

        // Override the file input change handler for videos
        this.overrideFileUploadHandler();
    }

    /**
     * Override file upload handler to handle videos directly
     */
    overrideFileUploadHandler() {
        const fileInput = document.getElementById('add_bg_button');
        if (!fileInput) {
            logger.warn(`${LOG_PREFIX} File input not found, will retry later`);
            setTimeout(() => this.overrideFileUploadHandler(), 1000);
            return;
        }

        // Store original handler
        const originalHandler = fileInput.onchange;
        
        // Override with our enhanced handler
        fileInput.onchange = async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) {
                // No files selected, call original handler
                if (originalHandler) {
                    originalHandler.call(fileInput, event);
                }
                return;
            }

            const file = files[0];
            const mediaType = this.getEnhancedMediaType(file.name);
            
            logger.info(`${LOG_PREFIX} File upload intercepted:`, file.name, 'Type:', mediaType);

            // Handle video files directly without conversion
            if (mediaType === this.MEDIA_TYPES.VIDEO) {
                await this.handleVideoUpload(file, event.target);
                return;
            }

            // For non-video files, use original handler
            if (originalHandler) {
                originalHandler.call(fileInput, event);
            }
        };

        logger.debug(`${LOG_PREFIX} File upload handler overridden`);
    }

    /**
     * Handle video file upload directly
     */
    async handleVideoUpload(file, inputElement) {
        try {
            logger.info(`${LOG_PREFIX} Processing video upload:`, file.name);
            
            // Create a blob URL for immediate preview
            const videoUrl = URL.createObjectURL(file);
            
            // Set as background immediately
            this.setAnimatedBackground(videoUrl, this.MEDIA_TYPES.VIDEO);
            
            // Add to chat backgrounds metadata for persistence
            if (window.chat_metadata && window.saveMetadataDebounced) {
                const LIST_METADATA_KEY = 'chat_backgrounds';
                const list = window.chat_metadata[LIST_METADATA_KEY] || [];
                
                // Store the blob URL with a unique identifier
                const videoId = 'video_' + Date.now() + '_' + file.name;
                list.push(videoId);
                window.chat_metadata[LIST_METADATA_KEY] = list;
                window.saveMetadataDebounced();
                
                // Store the blob URL for later retrieval
                this.storeVideoBlob(videoId, videoUrl, file.name);
                
                // Refresh backgrounds list if possible
                if (window.getChatBackgroundsList) {
                    await window.getChatBackgroundsList();
                }
            }

            // Also try to upload to server for persistence (optional)
            await this.uploadVideoToServer(file);
            
            toastr.success('Video background set successfully');
            
            // Reset the input
            inputElement.value = '';
            
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error handling video upload:`, error);
            toastr.error('Failed to set video background');
        }
    }

    /**
     * Store video blob for later retrieval
     */
    storeVideoBlob(videoId, blobUrl, fileName) {
        if (!window.videoBackgroundStorage) {
            window.videoBackgroundStorage = new Map();
        }
        
        window.videoBackgroundStorage.set(videoId, {
            blobUrl: blobUrl,
            fileName: fileName,
            timestamp: Date.now()
        });
        
        logger.debug(`${LOG_PREFIX} Video blob stored:`, videoId);
    }

    /**
     * Retrieve video blob
     */
    getVideoBlob(videoId) {
        if (window.videoBackgroundStorage) {
            return window.videoBackgroundStorage.get(videoId);
        }
        return null;
    }

    /**
     * Upload video to server (optional, for persistence across sessions)
     */
    async uploadVideoToServer(file) {
        try {
            // Create form data
            const formData = new FormData();
            formData.set('avatar', file);
            
            // Try to upload using SillyTavern's upload endpoint
            const response = await fetch('/api/backgrounds/upload', {
                method: 'POST',
                headers: window.getRequestHeaders ? window.getRequestHeaders({ omitContentType: true }) : {},
                body: formData,
                cache: 'no-cache',
            });

            if (response.ok) {
                const bgFileName = await response.text();
                logger.info(`${LOG_PREFIX} Video uploaded to server:`, bgFileName);
                
                // Update backgrounds list
                if (window.getBackgrounds) {
                    await window.getBackgrounds();
                }
                
                return bgFileName;
            } else {
                logger.warn(`${LOG_PREFIX} Server upload failed, using blob URL only`);
            }
        } catch (error) {
            logger.warn(`${LOG_PREFIX} Server upload error, using blob URL only:`, error);
        }
        
        return null;
    }

    /**
     * Handle YouTube URL paste
     */
    handleYouTubePaste(url) {
        logger.info(`${LOG_PREFIX} YouTube URL pasted:`, url);
        
        // Validate URL
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) {
            toastr.error('Invalid YouTube URL');
            return;
        }

        // Set the background
        this.setAnimatedBackground(url, this.MEDIA_TYPES.YOUTUBE);
        
        // Add to chat backgrounds if possible
        if (window.chat_metadata && window.saveMetadataDebounced) {
            const LIST_METADATA_KEY = 'chat_backgrounds';
            const list = window.chat_metadata[LIST_METADATA_KEY] || [];
            list.push(url);
            window.chat_metadata[LIST_METADATA_KEY] = list;
            window.saveMetadataDebounced();
            
            // Refresh backgrounds list if possible
            if (window.getChatBackgroundsList) {
                window.getChatBackgroundsList();
            }
        }

        toastr.success('YouTube background set successfully');
    }

    /**
     * Create settings UI
     */
    createSettingsUI() {
        const settings = this.getSettings();
        
        return `
            <div id="animated-backgrounds-settings" class="range-block">
                <h3>🎬 Animated Backgrounds</h3>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-enabled" ${settings.enabled ? 'checked' : ''}>
                        <span>Enable Enhanced Backgrounds</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-loop" ${settings.enableLoop ? 'checked' : ''}>
                        <span>Loop Videos</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-autoplay" ${settings.enableAutoplay ? 'checked' : ''}>
                        <span>Autoplay Videos</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-mute" ${settings.enableMute ? 'checked' : ''}>
                        <span>Mute Videos by Default</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label for="anim-bg-volume">Video Volume: <span id="anim-bg-volume-value">${Math.round(settings.videoVolume * 100)}%</span></label>
                    <input type="range" id="anim-bg-volume" min="0" max="1" step="0.1" value="${settings.videoVolume}">
                </div>
                
                <div class="range-block">
                    <label for="anim-bg-fitting">Background Fitting:</label>
                    <select id="anim-bg-fitting">
                        <option value="cover" ${settings.backgroundFitting === 'cover' ? 'selected' : ''}>Cover</option>
                        <option value="contain" ${settings.backgroundFitting === 'contain' ? 'selected' : ''}>Contain</option>
                        <option value="stretch" ${settings.backgroundFitting === 'stretch' ? 'selected' : ''}>Stretch</option>
                        <option value="center" ${settings.backgroundFitting === 'center' ? 'selected' : ''}>Center</option>
                    </select>
                </div>

                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-preload" ${settings.enablePreload ? 'checked' : ''}>
                        <span>Preload Videos</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-fallback" ${settings.fallbackToThumbnail ? 'checked' : ''}>
                        <span>Fallback to Thumbnail on Error</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <small style="color: #888;">
                        Supports MP4, WebM, GIF, and YouTube URLs.<br>
                        Paste YouTube URLs directly into the file upload area.
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Bind settings UI events
     */
    bindSettingsUI() {
        const settings = this.getSettings();

        $('#anim-bg-enabled').on('change', (e) => {
            settings.enabled = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-loop').on('change', (e) => {
            settings.enableLoop = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-autoplay').on('change', (e) => {
            settings.enableAutoplay = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-mute').on('change', (e) => {
            settings.enableMute = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-volume').on('input', (e) => {
            settings.videoVolume = parseFloat(e.target.value);
            $('#anim-bg-volume-value').text(Math.round(e.target.value * 100) + '%');
            this.saveSettings();
        });

        $('#anim-bg-fitting').on('change', (e) => {
            settings.backgroundFitting = e.target.value;
            this.saveSettings();
            
            // Apply new fitting to current background
            if (this.currentBackground) {
                this.setAnimatedBackground(this.currentBackground.source, this.currentBackground.mediaType);
            }
        });
        
        $('#anim-bg-preload').on('change', (e) => {
            settings.enablePreload = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-fallback').on('change', (e) => {
            settings.fallbackToThumbnail = e.target.checked;
            this.saveSettings();
        });
    }

    /**
     * Add settings to backgrounds panel
     */
    addSettingsToUI() {
        // Wait for backgrounds section to be available
        const checkForBackgrounds = setInterval(() => {
            const backgroundsSection = document.getElementById('Backgrounds');
            if (backgroundsSection) {
                clearInterval(checkForBackgrounds);
                
                // Check if settings already added
                if (document.getElementById('animated-backgrounds-settings')) {
                    return;
                }
                
                // Add settings UI
                backgroundsSection.insertAdjacentHTML('beforeend', this.createSettingsUI());
                this.bindSettingsUI();
                
                logger.debug(`${LOG_PREFIX} Settings UI added to backgrounds panel`);
            }
        }, 500);
    }
}

// Create and export a singleton instance
export const animatedBackgrounds = new AnimatedBackgroundsModule();