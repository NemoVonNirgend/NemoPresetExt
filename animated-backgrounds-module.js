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
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        this.youtubeApiReady = false;
        this.dragData = {
            isDragging: false,
            startX: 0,
            startY: 0,
            elementX: 0,
            elementY: 0
        };

        this.playlist = {
            items: [],
            currentIndex: -1,
            isPlaying: false,
            shuffle: false,
            repeat: false // false, 'one', 'all'
        };

        // Load existing favorites from localStorage
        this.favorites = this.loadFavorites();
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
            this.initializeYouTubeAPI();
            this.loadPlaylist();
            
            // Load favorites into background UI after a short delay to ensure UI is ready
            setTimeout(() => {
                this.loadFavoritesIntoBackgroundUI();
            }, 500);
            
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
     * Initialize YouTube Player API
     */
    initializeYouTubeAPI() {
        // Check if API is already loaded
        if (window.YT && window.YT.Player) {
            this.youtubeApiReady = true;
            logger.debug(`${LOG_PREFIX} YouTube API already loaded`);
            return;
        }

        // Load YouTube API script
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        
        // Set up API ready callback
        window.onYouTubeIframeAPIReady = () => {
            this.youtubeApiReady = true;
            logger.info(`${LOG_PREFIX} YouTube API loaded successfully`);
        };

        document.head.appendChild(script);
        logger.debug(`${LOG_PREFIX} Loading YouTube API...`);
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
        
        // Clear existing content and previous players
        container.innerHTML = '';
        container.className = 'bg-loading';
        
        // Clear previous video/player references
        if (this.youtubePlayer && typeof this.youtubePlayer.destroy === 'function') {
            try {
                this.youtubePlayer.destroy();
            } catch (e) {
                logger.debug(`${LOG_PREFIX} Error destroying previous YouTube player:`, e);
            }
        }
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        
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
        
        // Store reference to current video element
        this.currentVideoElement = video;
        
        // Show video controls when video is loaded
        video.onloadedmetadata = () => {
            this.showVideoControls();
        };
        
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

        // Wait for YouTube API to be ready
        if (!this.youtubeApiReady) {
            logger.info(`${LOG_PREFIX} Waiting for YouTube API to load...`);
            setTimeout(() => this.setYouTubeBackground(container, url), 1000);
            return;
        }

        // Create player container
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-background-player';
        playerContainer.style.cssText = `
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
        `;
        
        container.appendChild(playerContainer);

        // Initialize YouTube player with API
        const settings = this.getSettings();
        this.youtubePlayer = new window.YT.Player('youtube-background-player', {
            videoId: videoId,
            width: '100%',
            height: '100%',
            playerVars: {
                autoplay: settings.enableAutoplay ? 1 : 0,
                loop: settings.enableLoop ? 1 : 0,
                playlist: settings.enableLoop ? videoId : '',
                controls: 0,
                showinfo: 0,
                rel: 0,
                modestbranding: 1,
                iv_load_policy: 3,
                fs: 0,
                disablekb: 1,
                mute: settings.enableMute ? 1 : 0,
                start: 0
            },
            events: {
                onReady: (event) => {
                    logger.info(`${LOG_PREFIX} YouTube player ready`);
                    container.classList.remove('bg-loading');
                    
                    // Set initial volume
                    if (!settings.enableMute) {
                        event.target.setVolume(settings.videoVolume * 100);
                    }
                    
                    // Store reference for controls
                    this.currentVideoElement = event.target; // Store player instance
                    
                    // Automatically switch to transparent background for YouTube videos
                    this.switchToTransparentBackground();
                    
                    // Show YouTube controls
                    this.showYouTubeControls(event.target);
                },
                onStateChange: (event) => {
                    if (event.data === window.YT.PlayerState.ENDED && settings.enableLoop) {
                        event.target.playVideo();
                    }
                },
                onError: (event) => {
                    logger.error(`${LOG_PREFIX} YouTube player error:`, event.data);
                    container.classList.remove('bg-loading');
                }
            }
        });

        logger.debug(`${LOG_PREFIX} YouTube player initialized for video:`, videoId);
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
        
        // Clear current video element and YouTube player since this is not a video
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        this.hideVideoControls();
        
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
        
        // Clear current video element and YouTube player since this is not a video
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        this.hideVideoControls();
        
        logger.debug(`${LOG_PREFIX} Static image background set:`, source);
    }

    /**
     * Switch to SillyTavern's transparent background for YouTube videos
     */
    switchToTransparentBackground() {
        if (this.originalSetBackground && typeof this.originalSetBackground === 'function') {
            try {
                // Call SillyTavern's setBackground with __transparent
                this.originalSetBackground('__transparent', '', 'image');
                logger.info(`${LOG_PREFIX} Switched to transparent background for YouTube video`);
            } catch (error) {
                logger.warn(`${LOG_PREFIX} Failed to switch to transparent background:`, error);
            }
        } else {
            logger.warn(`${LOG_PREFIX} Original setBackground function not available`);
        }
    }

    /**
     * Hook into SillyTavern's background system
     */
    hookIntoBackgroundSystem() {
        // Store original functions
        const originalSetBackground = window.setBackground;
        const originalGetMediaType = window.getMediaType;
        
        // Store original setBackground for later use
        this.originalSetBackground = originalSetBackground;
        
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
                } else {
                    // For regular images, clear our enhanced background to prevent conflicts
                    this.clearAnimatedBackground();
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
     * PLAYLIST MANAGEMENT METHODS
     */

    /**
     * Add item to playlist
     * @param {string} source - Video source (URL or file path)
     * @param {string} mediaType - Media type
     * @param {Object} metadata - Additional metadata (title, duration, etc.)
     */
    addToPlaylist(source, mediaType, metadata = {}) {
        const item = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            source: source,
            mediaType: mediaType,
            title: metadata.title || this.extractTitleFromSource(source),
            thumbnail: metadata.thumbnail || null,
            duration: metadata.duration || null,
            addedAt: new Date().toISOString(),
            ...metadata
        };

        this.playlist.items.push(item);
        this.savePlaylist();
        
        logger.info(`${LOG_PREFIX} Added item to playlist:`, item.title);
        
        // If this is the first item, set it as current
        if (this.playlist.items.length === 1) {
            this.playlist.currentIndex = 0;
        }

        return item;
    }

    /**
     * Remove item from playlist
     */
    removeFromPlaylist(itemId) {
        const index = this.playlist.items.findIndex(item => item.id === itemId);
        if (index === -1) return false;

        const item = this.playlist.items[index];
        this.playlist.items.splice(index, 1);

        // Adjust current index if necessary
        if (index < this.playlist.currentIndex) {
            this.playlist.currentIndex--;
        } else if (index === this.playlist.currentIndex) {
            // If we removed the current item, reset or move to next
            if (this.playlist.items.length === 0) {
                this.playlist.currentIndex = -1;
            } else if (this.playlist.currentIndex >= this.playlist.items.length) {
                this.playlist.currentIndex = this.playlist.items.length - 1;
            }
        }

        this.savePlaylist();
        logger.info(`${LOG_PREFIX} Removed item from playlist:`, item.title);
        
        return true;
    }

    /**
     * Get current playlist item
     */
    getCurrentPlaylistItem() {
        if (this.playlist.currentIndex >= 0 && this.playlist.currentIndex < this.playlist.items.length) {
            return this.playlist.items[this.playlist.currentIndex];
        }
        return null;
    }

    /**
     * Play specific playlist item
     */
    playPlaylistItem(index) {
        if (index < 0 || index >= this.playlist.items.length) return false;

        this.playlist.currentIndex = index;
        const item = this.getCurrentPlaylistItem();
        
        if (item) {
            this.setAnimatedBackground(item.source, item.mediaType);
            this.playlist.isPlaying = true;
            this.savePlaylist();
            
            logger.info(`${LOG_PREFIX} Playing playlist item:`, item.title);
            return true;
        }
        
        return false;
    }

    /**
     * Play next item in playlist
     */
    playNext() {
        if (this.playlist.items.length === 0) return false;

        let nextIndex;
        
        if (this.playlist.shuffle) {
            // Random next item
            nextIndex = Math.floor(Math.random() * this.playlist.items.length);
        } else {
            nextIndex = this.playlist.currentIndex + 1;
            
            if (nextIndex >= this.playlist.items.length) {
                if (this.playlist.repeat === 'all') {
                    nextIndex = 0;
                } else {
                    return false; // End of playlist
                }
            }
        }

        return this.playPlaylistItem(nextIndex);
    }

    /**
     * Play previous item in playlist
     */
    playPrevious() {
        if (this.playlist.items.length === 0) return false;

        let prevIndex;
        
        if (this.playlist.shuffle) {
            // Random previous item (same as next in shuffle mode)
            prevIndex = Math.floor(Math.random() * this.playlist.items.length);
        } else {
            prevIndex = this.playlist.currentIndex - 1;
            
            if (prevIndex < 0) {
                if (this.playlist.repeat === 'all') {
                    prevIndex = this.playlist.items.length - 1;
                } else {
                    return false; // Start of playlist
                }
            }
        }

        return this.playPlaylistItem(prevIndex);
    }

    /**
     * Play specific playlist item by index
     */
    playPlaylistItem(index) {
        if (this.playlist.items.length === 0 || index < 0 || index >= this.playlist.items.length) {
            return false;
        }

        const item = this.playlist.items[index];
        this.playlist.currentIndex = index;
        
        // Save current playlist state
        this.savePlaylist();

        logger.debug(`${LOG_PREFIX} Playing playlist item ${index}:`, item.title || item.source);

        // Set the background to the selected item
        this.setAnimatedBackground(item.source, item.mediaType);

        // Update controls if visible
        this.updatePlaylistControls();

        toastr.success(`Playing: ${item.title || 'Untitled'}`);
        
        return true;
    }

    /**
     * Update playlist controls UI
     */
    updatePlaylistControls() {
        const controls = document.getElementById('video-background-controls');
        if (!controls) return;

        const playlistButton = controls.querySelector('#youtube-playlist, #video-playlist');
        const playlistCount = controls.querySelector('.playlist-count');
        const previousButton = controls.querySelector('#youtube-previous, #video-previous');
        const nextButton = controls.querySelector('#youtube-next, #video-next');

        if (playlistButton) {
            playlistButton.setAttribute('title', `Playlist (${this.playlist.items.length})`);
        }

        if (playlistCount) {
            playlistCount.textContent = this.playlist.items.length;
        }

        if (previousButton) {
            previousButton.disabled = this.playlist.items.length <= 1;
        }

        if (nextButton) {
            nextButton.disabled = this.playlist.items.length <= 1;
        }
    }

    /**
     * Extract title from source URL
     */
    extractTitleFromSource(source) {
        if (this.isYouTubeUrl(source)) {
            const videoId = this.getYouTubeVideoId(source);
            return videoId ? `YouTube Video (${videoId})` : 'YouTube Video';
        } else if (source.includes('/')) {
            return source.split('/').pop();
        } else {
            return source;
        }
    }

    /**
     * Get YouTube video info including thumbnail
     */
    async getYouTubeVideoInfo(videoId) {
        try {
            // Use YouTube's thumbnail API (no API key required)
            const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            
            // Try to get video title using oEmbed API
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    title: data.title,
                    thumbnail: thumbnail,
                    author: data.author_name,
                    duration: null // Duration not available via oEmbed
                };
            } else {
                return {
                    title: `YouTube Video (${videoId})`,
                    thumbnail: thumbnail
                };
            }
        } catch (error) {
            logger.warn(`${LOG_PREFIX} Failed to get YouTube video info:`, error);
            return {
                title: `YouTube Video (${videoId})`,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            };
        }
    }

    /**
     * Save playlist to localStorage
     */
    savePlaylist() {
        try {
            localStorage.setItem('animated-bg-playlist', JSON.stringify(this.playlist));
            logger.debug(`${LOG_PREFIX} Playlist saved`);
        } catch (error) {
            logger.error(`${LOG_PREFIX} Failed to save playlist:`, error);
        }
    }

    /**
     * Load playlist from localStorage
     */
    loadPlaylist() {
        try {
            const savedPlaylist = localStorage.getItem('animated-bg-playlist');
            if (savedPlaylist) {
                const parsed = JSON.parse(savedPlaylist);
                this.playlist = { ...this.playlist, ...parsed };
                logger.debug(`${LOG_PREFIX} Playlist loaded with ${this.playlist.items.length} items`);
            }
        } catch (error) {
            logger.error(`${LOG_PREFIX} Failed to load playlist:`, error);
        }
    }

    /**
     * Clear entire playlist
     */
    clearPlaylist() {
        this.playlist.items = [];
        this.playlist.currentIndex = -1;
        this.playlist.isPlaying = false;
        this.savePlaylist();
        
        logger.info(`${LOG_PREFIX} Playlist cleared`);
    }

    /**
     * Update current video properties in real-time
     */
    updateCurrentVideoProperties(settings) {
        if (this.currentVideoElement) {
            // Handle HTML5 video elements
            if (this.currentVideoElement.tagName === 'VIDEO') {
                const video = this.currentVideoElement;
                
                // Update volume
                if (settings.enableMute) {
                    video.muted = true;
                    video.volume = 0;
                } else {
                    video.muted = false;
                    video.volume = settings.videoVolume;
                }
                
                // Update loop
                video.loop = settings.enableLoop;
                
                // Update background fitting
                video.style.objectFit = settings.backgroundFitting;
                
                logger.debug(`${LOG_PREFIX} Updated HTML5 video properties:`, {
                    volume: video.volume,
                    muted: video.muted,
                    loop: video.loop,
                    objectFit: video.style.objectFit
                });
            }
            // Handle YouTube player instances
            else if (this.currentVideoElement && typeof this.currentVideoElement.setVolume === 'function') {
                const player = this.currentVideoElement;
                
                try {
                    // Update volume
                    if (settings.enableMute) {
                        player.mute();
                    } else {
                        player.unMute();
                        player.setVolume(settings.videoVolume * 100);
                    }
                    
                    logger.debug(`${LOG_PREFIX} Updated YouTube player properties:`, {
                        volume: player.getVolume(),
                        muted: player.isMuted(),
                        videoVolume: settings.videoVolume
                    });
                } catch (error) {
                    logger.warn(`${LOG_PREFIX} Error updating YouTube player:`, error);
                }
            }
        }
    }

    /**
     * Get current video element
     */
    getCurrentVideoElement() {
        return this.currentVideoElement;
    }

    /**
     * Check if current background is a video
     */
    hasCurrentVideo() {
        return this.currentVideoElement && 
               (this.currentVideoElement.tagName === 'VIDEO' || 
                (typeof this.currentVideoElement.setVolume === 'function'));
    }

    /**
     * Show floating video controls
     */
    showVideoControls() {
        // Remove existing controls and restore button
        this.hideVideoControls();
        this.hideRestoreControlsButton();

        if (!this.hasCurrentVideo()) return;

        const video = this.currentVideoElement;
        const settings = this.getSettings();

        const controls = document.createElement('div');
        controls.id = 'video-background-controls';
        controls.className = 'enhanced-bg-controls visible';
        controls.innerHTML = `
            <div class="drag-handle" title="Drag to move"></div>
            <div class="resize-handle" title="Resize controls"></div>
            <div class="video-control-group">
                <button id="video-previous" title="Previous Track" ${this.playlist.items.length <= 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-backward-step"></i>
                </button>
                <button id="video-play-pause" title="Play/Pause">
                    <i class="fa-solid ${video.paused ? 'fa-play' : 'fa-pause'}"></i>
                </button>
                <button id="video-next" title="Next Track" ${this.playlist.items.length <= 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-forward-step"></i>
                </button>
            </div>
            <div class="video-control-group">
                <button id="video-mute-unmute" title="Mute/Unmute">
                    <i class="fa-solid ${video.muted ? 'fa-volume-mute' : 'fa-volume-high'}"></i>
                </button>
                <label for="video-live-volume">Vol: <span id="video-live-volume-value">${Math.round(video.volume * 100)}%</span></label>
                <input type="range" id="video-live-volume" min="0" max="1" step="0.05" value="${video.volume}">
            </div>
            <div class="video-control-group">
                <button id="video-favorite" title="Add to Favorites">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <button id="video-playlist" title="Show Playlist (${this.playlist.items.length} items)">
                    <i class="fa-solid fa-list"></i>
                    <span class="playlist-count">${this.playlist.items.length}</span>
                </button>
                <button id="video-restart" title="Restart">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button id="video-close-controls" title="Hide Controls">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(controls);

        // Load saved position
        this.loadControlsPosition(controls);

        // Bind control events
        this.bindVideoControlEvents(video, settings);
        this.bindDragEvents(controls);

        // Setup fade behavior
        this.setupControlsFadeBehavior(controls);

        // Initialize favorite button state
        this.updateFavoriteButton(this.isCurrentVideoFavorited());

        logger.debug(`${LOG_PREFIX} Video controls shown`);
    }

    /**
     * Hide floating video controls
     */
    hideVideoControls() {
        const existingControls = document.getElementById('video-background-controls');
        if (existingControls) {
            existingControls.remove();
        }

        // Show the restore button if we have an active video
        if (this.hasCurrentVideo()) {
            this.showRestoreControlsButton();
        }
    }

    /**
     * Show restore controls button
     */
    showRestoreControlsButton() {
        // Remove existing restore button
        const existingButton = document.getElementById('show-video-controls');
        if (existingButton) {
            existingButton.remove();
        }

        // Create restore button
        const restoreButton = document.createElement('button');
        restoreButton.id = 'show-video-controls';
        
        // Choose icon based on video type
        const videoElement = this.getCurrentVideoElement();
        let icon = 'fa-play';
        let title = 'Show Video Controls';
        
        if (videoElement && typeof videoElement.setVolume === 'function') {
            // YouTube player
            icon = 'fa-youtube';
            title = 'Show YouTube Controls';
        } else if (videoElement && videoElement.tagName === 'VIDEO') {
            // Regular video
            icon = 'fa-film';
            title = 'Show Video Controls';
        }
        
        restoreButton.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        restoreButton.title = title;
        
        // Add pulse effect initially
        restoreButton.classList.add('pulse');

        // Remove pulse after a few seconds
        setTimeout(() => {
            restoreButton.classList.remove('pulse');
        }, 6000);

        document.body.appendChild(restoreButton);

        // Bind click event
        restoreButton.addEventListener('click', () => {
            this.showCurrentVideoControls();
            restoreButton.remove();
        });

        logger.debug(`${LOG_PREFIX} Restore controls button shown`);
    }

    /**
     * Show controls for current video type
     */
    showCurrentVideoControls() {
        if (!this.hasCurrentVideo()) return;

        const videoElement = this.getCurrentVideoElement();
        
        // Check if it's a YouTube player or regular video
        if (videoElement && typeof videoElement.setVolume === 'function') {
            // YouTube player
            this.showYouTubeControls(videoElement);
        } else if (videoElement && videoElement.tagName === 'VIDEO') {
            // Regular video
            this.showVideoControls();
        }

        logger.debug(`${LOG_PREFIX} Current video controls restored`);
    }

    /**
     * Hide restore controls button
     */
    hideRestoreControlsButton() {
        const existingButton = document.getElementById('show-video-controls');
        if (existingButton) {
            existingButton.remove();
        }
    }

    /**
     * Clear animated background
     */
    clearAnimatedBackground() {
        // Hide all controls and restore button
        this.hideVideoControls();
        this.hideRestoreControlsButton();

        // Clear the enhanced background container
        const container = document.getElementById('enhanced-background-container');
        if (container) {
            container.innerHTML = '';
        }

        // Clear current video reference
        this.currentVideoElement = null;

        logger.debug(`${LOG_PREFIX} Animated background cleared`);
    }

    /**
     * Load favorites from localStorage
     */
    loadFavorites() {
        try {
            const saved = localStorage.getItem('animated-bg-favorites');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error loading favorites:`, error);
            return [];
        }
    }

    /**
     * Save favorites to localStorage
     */
    saveFavorites() {
        try {
            localStorage.setItem('animated-bg-favorites', JSON.stringify(this.favorites));
            logger.debug(`${LOG_PREFIX} Favorites saved:`, this.favorites.length, 'items');
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error saving favorites:`, error);
        }
    }

    /**
     * Add current video to favorites
     */
    async addToFavorites() {
        if (!this.hasCurrentVideo()) {
            toastr.error('No video currently playing to favorite');
            return false;
        }

        const videoElement = this.getCurrentVideoElement();
        let favoriteData = {
            url: '',
            type: '',
            title: 'Untitled',
            thumbnail: '',
            dateAdded: new Date().toISOString()
        };

        // Determine current video data
        if (typeof videoElement.setVolume === 'function') {
            // YouTube player
            const videoData = videoElement.getVideoData();
            const videoId = videoData.video_id;
            favoriteData.url = `https://www.youtube.com/watch?v=${videoId}`;
            favoriteData.type = this.MEDIA_TYPES.YOUTUBE;
            favoriteData.title = videoData.title || `YouTube Video (${videoId})`;
            favoriteData.thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        } else if (videoElement.tagName === 'VIDEO') {
            // Regular video
            favoriteData.url = videoElement.src;
            favoriteData.type = this.MEDIA_TYPES.VIDEO;
            favoriteData.title = this.extractTitleFromSource(videoElement.src);
            favoriteData.thumbnail = videoElement.poster || '';
        } else {
            toastr.error('Unable to determine video type for favorites');
            return false;
        }

        // Check if already favorited
        const exists = this.favorites.some(fav => fav.url === favoriteData.url);
        if (exists) {
            toastr.info('Video already in favorites');
            this.updateFavoriteButton(true);
            return false;
        }

        // Add to favorites
        this.favorites.push(favoriteData);
        this.saveFavorites();
        this.updateFavoriteButton(true);
        this.addFavoriteToBackgroundUI(favoriteData);

        toastr.success(`"${favoriteData.title}" added to favorites`);
        logger.debug(`${LOG_PREFIX} Added to favorites:`, favoriteData);
        
        return true;
    }

    /**
     * Remove from favorites
     */
    removeFromFavorites(url) {
        const index = this.favorites.findIndex(fav => fav.url === url);
        if (index !== -1) {
            const removed = this.favorites.splice(index, 1)[0];
            this.saveFavorites();
            this.updateFavoriteButton(false);
            this.removeFavoriteFromBackgroundUI(url);
            toastr.success(`"${removed.title}" removed from favorites`);
            return true;
        }
        return false;
    }

    /**
     * Check if current video is favorited
     */
    isCurrentVideoFavorited() {
        if (!this.hasCurrentVideo()) return false;

        const videoElement = this.getCurrentVideoElement();
        let currentUrl = '';

        if (typeof videoElement.setVolume === 'function') {
            // YouTube
            const videoData = videoElement.getVideoData();
            currentUrl = `https://www.youtube.com/watch?v=${videoData.video_id}`;
        } else if (videoElement.tagName === 'VIDEO') {
            // Regular video
            currentUrl = videoElement.src;
        }

        return this.favorites.some(fav => fav.url === currentUrl);
    }

    /**
     * Update favorite button appearance
     */
    updateFavoriteButton(isFavorited) {
        const youtubeBtn = document.getElementById('youtube-favorite');
        const videoBtn = document.getElementById('video-favorite');
        
        if (youtubeBtn) {
            const icon = youtubeBtn.querySelector('i');
            if (isFavorited) {
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-solid');
                youtubeBtn.style.color = '#ff6b6b';
                youtubeBtn.title = 'Remove from Favorites';
            } else {
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-regular');
                youtubeBtn.style.color = '';
                youtubeBtn.title = 'Add to Favorites';
            }
        }

        if (videoBtn) {
            const icon = videoBtn.querySelector('i');
            if (isFavorited) {
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-solid');
                videoBtn.style.color = '#ff6b6b';
                videoBtn.title = 'Remove from Favorites';
            } else {
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-regular');
                videoBtn.style.color = '';
                videoBtn.title = 'Add to Favorites';
            }
        }
    }

    /**
     * Add favorite to background selection UI
     */
    addFavoriteToBackgroundUI(favoriteData) {
        try {
            // Find the background list container
            const bgList = document.querySelector('#bg_list, .bg_list');
            if (!bgList) {
                logger.warn(`${LOG_PREFIX} Could not find background list to add favorite`);
                return;
            }

            // Create favorite background item
            const bgItem = document.createElement('div');
            bgItem.className = 'bg_example';
            bgItem.setAttribute('data-media-type', favoriteData.type);
            bgItem.setAttribute('data-favorite-url', favoriteData.url);
            bgItem.title = favoriteData.title;
            
            // Create thumbnail
            let thumbnailSrc = favoriteData.thumbnail;
            if (!thumbnailSrc || thumbnailSrc === '') {
                // Fallback thumbnail based on type
                if (favoriteData.type === this.MEDIA_TYPES.YOUTUBE) {
                    const videoId = this.getYouTubeVideoId(favoriteData.url);
                    thumbnailSrc = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                } else {
                    // Use a default video icon
                    thumbnailSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTIwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+VmlkZW88L3RleHQ+PC9zdmc+';
                }
            }

            bgItem.style.cssText = `
                background-image: url("${thumbnailSrc}");
                background-size: cover;
                background-position: center;
                position: relative;
            `;

            // Add favorite indicator
            const favoriteIndicator = document.createElement('div');
            favoriteIndicator.className = 'favorite-indicator';
            favoriteIndicator.innerHTML = '<i class="fa-solid fa-heart"></i>';
            favoriteIndicator.style.cssText = `
                position: absolute;
                top: 5px;
                left: 5px;
                background: rgba(255, 107, 107, 0.9);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                z-index: 10;
            `;
            bgItem.appendChild(favoriteIndicator);

            // Add click handler
            bgItem.addEventListener('click', () => {
                this.setAnimatedBackground(favoriteData.url, favoriteData.type);
            });

            // Add to beginning of list (most recent first)
            bgList.insertBefore(bgItem, bgList.firstChild);

            logger.debug(`${LOG_PREFIX} Added favorite to background UI:`, favoriteData.title);
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error adding favorite to UI:`, error);
        }
    }

    /**
     * Remove favorite from background selection UI
     */
    removeFavoriteFromBackgroundUI(url) {
        try {
            const favoriteItems = document.querySelectorAll(`[data-favorite-url="${url}"]`);
            favoriteItems.forEach(item => {
                item.remove();
            });
            logger.debug(`${LOG_PREFIX} Removed favorite from background UI:`, url);
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error removing favorite from UI:`, error);
        }
    }

    /**
     * Load all favorites into background UI
     */
    loadFavoritesIntoBackgroundUI() {
        // Load favorites in reverse order (newest first)
        const sortedFavorites = [...this.favorites].reverse();
        sortedFavorites.forEach(favorite => {
            this.addFavoriteToBackgroundUI(favorite);
        });
        logger.debug(`${LOG_PREFIX} Loaded ${this.favorites.length} favorites into background UI`);
    }

    /**
     * Bind video control events
     */
    bindVideoControlEvents(video, settings) {
        // Play/Pause button
        $('#video-play-pause').on('click', () => {
            if (video.paused) {
                video.play();
                $('#video-play-pause i').removeClass('fa-play').addClass('fa-pause');
            } else {
                video.pause();
                $('#video-play-pause i').removeClass('fa-pause').addClass('fa-play');
            }
        });

        // Mute/Unmute button
        $('#video-mute-unmute').on('click', () => {
            video.muted = !video.muted;
            settings.enableMute = video.muted;
            this.saveSettings();
            
            $('#video-mute-unmute i').removeClass('fa-volume-high fa-volume-mute')
                .addClass(video.muted ? 'fa-volume-mute' : 'fa-volume-high');
            
            // Update settings UI
            $('#anim-bg-mute').prop('checked', video.muted);
        });

        // Live volume control
        $('#video-live-volume').on('input', (e) => {
            const volume = parseFloat(e.target.value);
            video.volume = volume;
            video.muted = false;
            
            settings.videoVolume = volume;
            settings.enableMute = false;
            this.saveSettings();
            
            $('#video-live-volume-value').text(Math.round(volume * 100) + '%');
            $('#video-mute-unmute i').removeClass('fa-volume-high fa-volume-mute').addClass('fa-volume-high');
            
            // Update settings UI
            $('#anim-bg-volume').val(volume);
            $('#anim-bg-volume-value').text(Math.round(volume * 100) + '%');
            $('#anim-bg-mute').prop('checked', false);
        });

        // Restart button
        $('#video-restart').on('click', () => {
            video.currentTime = 0;
            if (video.paused) {
                video.play();
                $('#video-play-pause i').removeClass('fa-play').addClass('fa-pause');
            }
        });

        // Playlist button
        $('#video-playlist').on('click', () => {
            this.showPlaylistWindow();
        });
        
        // Previous button
        $('#video-previous').on('click', () => {
            this.playPrevious();
        });
        
        // Next button
        $('#video-next').on('click', () => {
            this.playNext();
        });

        // Favorite button
        $('#video-favorite').on('click', () => {
            if (this.isCurrentVideoFavorited()) {
                // Remove from favorites
                const videoElement = this.getCurrentVideoElement();
                const url = videoElement.src;
                this.removeFromFavorites(url);
            } else {
                // Add to favorites
                this.addToFavorites();
            }
        });

        // Close controls button
        $('#video-close-controls').on('click', () => {
            this.hideVideoControls();
        });

        // Show controls on hover over video area
        $(video).on('mouseenter', () => {
            const controls = document.getElementById('video-background-controls');
            if (controls) {
                controls.style.opacity = '1';
            }
        });
    }

    /**
     * Setup fade behavior for controls
     */
    setupControlsFadeBehavior(controls) {
        let fadeTimeout;

        const fadeOut = () => {
            if (!this.dragData.isDragging) {
                controls.classList.add('faded');
            }
        };

        const fadeIn = () => {
            clearTimeout(fadeTimeout);
            controls.classList.remove('faded');
        };

        // Fade in on hover
        controls.addEventListener('mouseenter', fadeIn);
        
        // Fade out after delay when mouse leaves
        controls.addEventListener('mouseleave', () => {
            if (!this.dragData.isDragging) {
                fadeTimeout = setTimeout(fadeOut, 2000); // 2 second delay
            }
        });

        // Initial fade out after 5 seconds
        setTimeout(fadeOut, 5000);
    }

    /**
     * Bind drag events to controls
     */
    bindDragEvents(controls) {
        // Wait for next tick to ensure DOM is ready
        setTimeout(() => {
            const dragHandle = controls.querySelector('.drag-handle');
            if (!dragHandle) {
                logger.warn(`${LOG_PREFIX} Drag handle not found in controls`);
                return;
            }

            logger.debug(`${LOG_PREFIX} Binding drag events to handle`);

            // Store bound functions to prevent multiple bindings
            if (!this.boundDragHandlers) {
                this.boundDragHandlers = {
                    mouseMove: (e) => this.handleDrag(e, controls),
                    mouseUp: () => this.endDrag(controls),
                    touchMove: (e) => {
                        if (this.dragData.isDragging) {
                            e.preventDefault();
                            this.handleDrag(e.touches[0], controls);
                        }
                    },
                    touchEnd: () => this.endDrag(controls)
                };
            }

            // Mouse events on drag handle
            dragHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.debug(`${LOG_PREFIX} Drag handle mousedown`);
                this.startDrag(e, controls);
            });

            // Global mouse events (only bind once)
            document.removeEventListener('mousemove', this.boundDragHandlers.mouseMove);
            document.removeEventListener('mouseup', this.boundDragHandlers.mouseUp);
            document.addEventListener('mousemove', this.boundDragHandlers.mouseMove);
            document.addEventListener('mouseup', this.boundDragHandlers.mouseUp);

            // Touch events for mobile
            dragHandle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startDrag(e.touches[0], controls);
            });

            // Global touch events (only bind once)
            document.removeEventListener('touchmove', this.boundDragHandlers.touchMove, { passive: false });
            document.removeEventListener('touchend', this.boundDragHandlers.touchEnd);
            document.addEventListener('touchmove', this.boundDragHandlers.touchMove, { passive: false });
            document.addEventListener('touchend', this.boundDragHandlers.touchEnd);

            // Prevent drag on control elements
            controls.querySelectorAll('button, input, label').forEach(element => {
                element.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                element.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                });
            });

            // Fallback: Allow dragging on the entire controls element if handle fails
            controls.addEventListener('mousedown', (e) => {
                // Only allow drag if clicking on controls background (not buttons/inputs)
                if (e.target === controls || e.target.classList.contains('video-control-group')) {
                    logger.debug(`${LOG_PREFIX} Fallback drag triggered on controls background`);
                    e.preventDefault();
                    e.stopPropagation();
                    this.startDrag(e, controls);
                }
            });

            // Add visual feedback for draggability
            dragHandle.style.cursor = 'grab';
            
            // Test click event on handle
            dragHandle.addEventListener('click', (e) => {
                logger.debug(`${LOG_PREFIX} Drag handle clicked`);
                e.preventDefault();
                e.stopPropagation();
            });

            // Test drag handle visibility
            const handleRect = dragHandle.getBoundingClientRect();
            logger.debug(`${LOG_PREFIX} Drag handle positioned at:`, {
                top: handleRect.top,
                left: handleRect.left,
                width: handleRect.width,
                height: handleRect.height,
                visible: handleRect.width > 0 && handleRect.height > 0
            });

        }, 100);
    }

    /**
     * Start dragging
     */
    startDrag(event, controls) {
        logger.info(`${LOG_PREFIX} Starting drag operation`);
        
        this.dragData.isDragging = true;
        this.dragData.startX = event.clientX;
        this.dragData.startY = event.clientY;
        
        const rect = controls.getBoundingClientRect();
        this.dragData.elementX = rect.left;
        this.dragData.elementY = rect.top;

        controls.classList.add('dragging');
        controls.classList.remove('faded');
        
        // Prevent text selection
        document.body.style.userSelect = 'none';
        
        logger.debug(`${LOG_PREFIX} Drag started from:`, {
            startX: event.clientX,
            startY: event.clientY,
            elementX: rect.left,
            elementY: rect.top
        });
    }

    /**
     * Handle drag movement
     */
    handleDrag(event, controls) {
        if (!this.dragData.isDragging) return;

        const deltaX = event.clientX - this.dragData.startX;
        const deltaY = event.clientY - this.dragData.startY;

        const newX = this.dragData.elementX + deltaX;
        const newY = this.dragData.elementY + deltaY;

        // Constrain to viewport
        const rect = controls.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        controls.style.left = constrainedX + 'px';
        controls.style.top = constrainedY + 'px';
        controls.style.right = 'auto';
        controls.style.bottom = 'auto';
    }

    /**
     * End dragging
     */
    endDrag(controls) {
        if (!this.dragData.isDragging) return;

        this.dragData.isDragging = false;
        controls.classList.remove('dragging');
        
        // Restore text selection
        document.body.style.userSelect = '';

        // Save position
        this.saveControlsPosition(controls);

        logger.debug(`${LOG_PREFIX} Ended dragging controls`);
    }

    /**
     * Save controls position to localStorage
     */
    saveControlsPosition(controls) {
        const rect = controls.getBoundingClientRect();
        const position = {
            x: rect.left,
            y: rect.top
        };

        localStorage.setItem('animated-bg-controls-position', JSON.stringify(position));
        logger.debug(`${LOG_PREFIX} Saved controls position:`, position);
    }

    /**
     * Load controls position from localStorage
     */
    loadControlsPosition(controls) {
        const savedPosition = localStorage.getItem('animated-bg-controls-position');
        if (!savedPosition) return;

        try {
            const position = JSON.parse(savedPosition);
            
            // Validate position is within viewport
            const maxX = window.innerWidth - controls.offsetWidth;
            const maxY = window.innerHeight - controls.offsetHeight;
            
            const x = Math.max(0, Math.min(position.x, maxX));
            const y = Math.max(0, Math.min(position.y, maxY));

            controls.style.left = x + 'px';
            controls.style.top = y + 'px';
            controls.style.right = 'auto';
            controls.style.bottom = 'auto';

            logger.debug(`${LOG_PREFIX} Loaded controls position:`, { x, y });
        } catch (error) {
            logger.warn(`${LOG_PREFIX} Error loading controls position:`, error);
        }
    }

    /**
     * Show YouTube-specific controls
     */
    showYouTubeControls(player) {
        // Remove existing controls and restore button
        this.hideVideoControls();
        this.hideRestoreControlsButton();

        const settings = this.getSettings();

        const controls = document.createElement('div');
        controls.id = 'video-background-controls';
        controls.className = 'enhanced-bg-controls visible';
        controls.innerHTML = `
            <div class="drag-handle" title="Drag to move"></div>
            <div class="resize-handle" title="Resize controls"></div>
            <div class="video-control-group">
                <button id="youtube-previous" title="Previous" ${this.playlist.items.length <= 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-step-backward"></i>
                </button>
                <button id="youtube-play-pause" title="Play/Pause">
                    <i class="fa-solid fa-pause"></i>
                </button>
                <button id="youtube-next" title="Next" ${this.playlist.items.length <= 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-step-forward"></i>
                </button>
                <button id="youtube-mute-unmute" title="Mute/Unmute">
                    <i class="fa-solid ${player.isMuted() ? 'fa-volume-mute' : 'fa-volume-high'}"></i>
                </button>
            </div>
            <div class="video-control-group">
                <label for="youtube-live-volume">Vol: <span id="youtube-live-volume-value">${Math.round(player.getVolume())}%</span></label>
                <input type="range" id="youtube-live-volume" min="0" max="100" step="5" value="${player.getVolume()}">
            </div>
            <div class="video-control-group">
                <button id="youtube-favorite" title="Add to Favorites">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <button id="youtube-restart" title="Restart">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button id="youtube-playlist" title="Playlist (${this.playlist.items.length})">
                    <i class="fa-solid fa-list"></i>
                    <span class="playlist-count">${this.playlist.items.length}</span>
                </button>
                <button id="youtube-close-controls" title="Hide Controls">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(controls);

        // Load saved position
        this.loadControlsPosition(controls);

        // Bind YouTube control events
        this.bindYouTubeControlEvents(player, settings);
        this.bindDragEvents(controls);

        // Setup fade behavior
        this.setupControlsFadeBehavior(controls);

        // Initialize favorite button state
        this.updateFavoriteButton(this.isCurrentVideoFavorited());

        logger.debug(`${LOG_PREFIX} YouTube controls shown`);
    }

    /**
     * Bind YouTube control events
     */
    bindYouTubeControlEvents(player, settings) {
        // Play/Pause button
        $('#youtube-play-pause').on('click', () => {
            const playerState = player.getPlayerState();
            if (playerState === window.YT.PlayerState.PLAYING) {
                player.pauseVideo();
                $('#youtube-play-pause i').removeClass('fa-pause').addClass('fa-play');
            } else {
                player.playVideo();
                $('#youtube-play-pause i').removeClass('fa-play').addClass('fa-pause');
            }
        });

        // Mute/Unmute button
        $('#youtube-mute-unmute').on('click', () => {
            if (player.isMuted()) {
                player.unMute();
                $('#youtube-mute-unmute i').removeClass('fa-volume-mute').addClass('fa-volume-high');
                settings.enableMute = false;
            } else {
                player.mute();
                $('#youtube-mute-unmute i').removeClass('fa-volume-high').addClass('fa-volume-mute');
                settings.enableMute = true;
            }
            this.saveSettings();
            
            // Update settings UI
            $('#anim-bg-mute').prop('checked', settings.enableMute);
        });

        // Live volume control
        $('#youtube-live-volume').on('input', (e) => {
            const volume = parseInt(e.target.value);
            player.setVolume(volume);
            player.unMute(); // Unmute when adjusting volume
            
            settings.videoVolume = volume / 100;
            settings.enableMute = false;
            this.saveSettings();
            
            $('#youtube-live-volume-value').text(volume + '%');
            $('#youtube-mute-unmute i').removeClass('fa-volume-mute').addClass('fa-volume-high');
            
            // Update settings UI
            $('#anim-bg-volume').val(volume / 100);
            $('#anim-bg-volume-value').text(volume + '%');
            $('#anim-bg-mute').prop('checked', false);
        });

        // Restart button
        $('#youtube-restart').on('click', () => {
            player.seekTo(0);
            player.playVideo();
            $('#youtube-play-pause i').removeClass('fa-play').addClass('fa-pause');
        });

        // Previous button
        $('#youtube-previous').on('click', () => {
            this.playPrevious();
        });

        // Next button
        $('#youtube-next').on('click', () => {
            this.playNext();
        });

        // Playlist button
        $('#youtube-playlist').on('click', () => {
            this.showPlaylistWindow();
        });

        // Favorite button
        $('#youtube-favorite').on('click', () => {
            if (this.isCurrentVideoFavorited()) {
                // Remove from favorites
                const videoElement = this.getCurrentVideoElement();
                const videoData = videoElement.getVideoData();
                const url = `https://www.youtube.com/watch?v=${videoData.video_id}`;
                this.removeFromFavorites(url);
            } else {
                // Add to favorites
                this.addToFavorites();
            }
        });

        // Close controls button
        $('#youtube-close-controls').on('click', () => {
            this.hideVideoControls();
        });
    }

    /**
     * Show playlist window
     */
    showPlaylistWindow() {
        // Remove existing playlist window
        $('#playlist-window').remove();

        if (this.playlist.items.length === 0) {
            toastr.info('Playlist is empty');
            return;
        }

        const playlistWindow = document.createElement('div');
        playlistWindow.id = 'playlist-window';
        playlistWindow.className = 'playlist-window';
        
        let playlistHtml = `
            <div class="playlist-header">
                <h3><i class="fa-solid fa-list"></i> Playlist (${this.playlist.items.length})</h3>
                <div class="playlist-controls">
                    <button id="clear-playlist" title="Clear Playlist">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button id="close-playlist" title="Close">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="playlist-content">
        `;

        this.playlist.items.forEach((item, index) => {
            const isActive = this.playlist.currentIndex === index;
            const thumbnail = item.thumbnail || (this.isYouTubeUrl(item.source) ? 
                'https://img.youtube.com/vi/' + this.getYouTubeVideoId(item.source) + '/default.jpg' : 
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTIwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+VmlkZW88L3RleHQ+PC9zdmc+');
            
            playlistHtml += `
                <div class="playlist-item ${isActive ? 'active' : ''}" data-index="${index}">
                    <img src="${thumbnail}" alt="Video thumbnail" class="playlist-thumbnail" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTIwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'">
                    <div class="playlist-item-info">
                        <div class="playlist-item-title">${item.title || item.source.split('/').pop() || 'Untitled'}</div>
                        <div class="playlist-item-type">${item.mediaType}</div>
                    </div>
                    <div class="playlist-item-actions">
                        <button class="play-item" data-index="${index}" title="Play">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button class="move-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-chevron-up"></i>
                        </button>
                        <button class="move-down" data-index="${index}" title="Move Down" ${index === this.playlist.items.length - 1 ? 'disabled' : ''}>
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <button class="remove-item" data-index="${index}" title="Remove">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        playlistHtml += `
            </div>
        `;

        playlistWindow.innerHTML = playlistHtml;
        document.body.appendChild(playlistWindow);

        // Bind playlist window events
        this.bindPlaylistWindowEvents();

        logger.debug(`${LOG_PREFIX} Playlist window shown`);
    }

    /**
     * Bind playlist window events
     */
    bindPlaylistWindowEvents() {
        // Close playlist window
        $('#close-playlist').on('click', () => {
            $('#playlist-window').remove();
        });

        // Clear playlist
        $('#clear-playlist').on('click', () => {
            if (confirm('Are you sure you want to clear the entire playlist?')) {
                this.clearPlaylist();
                $('#playlist-window').remove();
                toastr.success('Playlist cleared');
                
                // Update controls if visible
                const controls = document.getElementById('video-background-controls');
                if (controls) {
                    controls.querySelector('.playlist-count').textContent = '0';
                    const prevBtn = controls.querySelector('#youtube-previous, #video-previous');
                    const nextBtn = controls.querySelector('#youtube-next, #video-next');
                    const playlistBtn = controls.querySelector('#youtube-playlist, #video-playlist');
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = true;
                    if (playlistBtn) playlistBtn.setAttribute('title', 'Playlist (0)');
                }
            }
        });

        // Play specific item
        $('.play-item').on('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            this.playPlaylistItem(index);
            $('#playlist-window').remove();
        });

        // Remove item
        $('.remove-item').on('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            const item = this.playlist.items[index];
            if (item) {
                this.removeFromPlaylist(item.id);
            }
            
            // Refresh playlist window
            this.showPlaylistWindow();
        });

        // Move item up
        $('.move-up').on('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            if (index > 0) {
                // Swap items
                const temp = this.playlist.items[index];
                this.playlist.items[index] = this.playlist.items[index - 1];
                this.playlist.items[index - 1] = temp;

                // Update current index if needed
                if (this.playlist.currentIndex === index) {
                    this.playlist.currentIndex = index - 1;
                } else if (this.playlist.currentIndex === index - 1) {
                    this.playlist.currentIndex = index;
                }

                this.savePlaylist();
                this.showPlaylistWindow(); // Refresh
            }
        });

        // Move item down
        $('.move-down').on('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            if (index < this.playlist.items.length - 1) {
                // Swap items
                const temp = this.playlist.items[index];
                this.playlist.items[index] = this.playlist.items[index + 1];
                this.playlist.items[index + 1] = temp;

                // Update current index if needed
                if (this.playlist.currentIndex === index) {
                    this.playlist.currentIndex = index + 1;
                } else if (this.playlist.currentIndex === index + 1) {
                    this.playlist.currentIndex = index;
                }

                this.savePlaylist();
                this.showPlaylistWindow(); // Refresh
            }
        });

        // Click outside to close
        $(document).on('click.playlist-window', (e) => {
            if (!$(e.target).closest('#playlist-window, #youtube-playlist').length) {
                $('#playlist-window').remove();
                $(document).off('click.playlist-window');
            }
        });
    }

    /**
     * Handle YouTube URL paste
     */
    async handleYouTubePaste(url) {
        logger.info(`${LOG_PREFIX} YouTube URL pasted:`, url);
        
        // Validate URL
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) {
            toastr.error('Invalid YouTube URL');
            return;
        }

        // Get YouTube video info
        const videoInfo = await this.getYouTubeVideoInfo(videoId);
        
        // Add to playlist
        const playlistItem = this.addToPlaylist(url, this.MEDIA_TYPES.YOUTUBE, videoInfo);
        
        // Only play immediately if playlist was empty or no current video
        if (this.playlist.length === 1 || !this.hasCurrentVideo()) {
            this.currentPlaylistIndex = this.playlist.length - 1;
            this.setAnimatedBackground(url, this.MEDIA_TYPES.YOUTUBE);
        } else {
            // Update controls to show new playlist count
            this.updatePlaylistControls();
        }
        
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

        toastr.success(`Added "${videoInfo.title}" to playlist`);
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
            // Update current video immediately
            this.updateCurrentVideoProperties(settings);
        });
        
        $('#anim-bg-autoplay').on('change', (e) => {
            settings.enableAutoplay = e.target.checked;
            this.saveSettings();
        });
        
        $('#anim-bg-mute').on('change', (e) => {
            settings.enableMute = e.target.checked;
            this.saveSettings();
            // Update current video volume immediately
            this.updateCurrentVideoProperties(settings);
        });
        
        $('#anim-bg-volume').on('input', (e) => {
            settings.videoVolume = parseFloat(e.target.value);
            $('#anim-bg-volume-value').text(Math.round(e.target.value * 100) + '%');
            this.saveSettings();
            // Update current video volume immediately
            this.updateCurrentVideoProperties(settings);
        });

        $('#anim-bg-fitting').on('change', (e) => {
            settings.backgroundFitting = e.target.value;
            this.saveSettings();
            // Update current video fitting immediately
            this.updateCurrentVideoProperties(settings);
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