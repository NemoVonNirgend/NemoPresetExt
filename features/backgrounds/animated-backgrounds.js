/**
 * Animated Backgrounds Extension for SillyTavern
 * Enhanced background system supporting webm, gif, mp4, and YouTube URLs
 * Author: Extension Developer
 * Version: 1.0.0
 */

(function() {
    'use strict';

    const EXTENSION_NAME = 'Animated Backgrounds';
    const EXTENSION_ID = 'animated-backgrounds';
    
    // Enhanced media types
    const MEDIA_TYPES = {
        VIDEO: 'video',
        ANIMATED_IMAGE: 'animated_image', 
        STATIC_IMAGE: 'image',
        YOUTUBE: 'youtube',
        EMBED: 'embed'
    };

    // Supported file extensions
    const EXTENSIONS = {
        video: ['mp4', 'webm', 'avi', 'mov', 'mkv'],
        animated_image: ['gif', 'webp'],
        image: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'svg']
    };

    let extensionSettings = {
        enableLoop: true,
        enableAutoplay: true,
        enableMute: true,
        videoVolume: 0.1,
        enablePreload: true,
        fallbackToThumbnail: true,
        youtubeQuality: 'hd720',
        enableParticles: false
    };

    /**
     * Enhanced media type detection
     * @param {string} fileName - File name or URL
     * @returns {string} Media type
     */
    function getEnhancedMediaType(fileName) {
        if (!fileName) return MEDIA_TYPES.STATIC_IMAGE;
        
        // Handle URLs
        if (fileName.startsWith('http')) {
            if (isYouTubeUrl(fileName)) {
                return MEDIA_TYPES.YOUTUBE;
            }
            // For other URLs, try to detect by extension in URL
            const urlPath = new URL(fileName).pathname;
            const extension = urlPath.split('.').pop()?.toLowerCase();
            if (extension) {
                return getMediaTypeByExtension(extension);
            }
            return MEDIA_TYPES.STATIC_IMAGE;
        }
        
        // Handle local files
        const extension = fileName.split('.').pop()?.toLowerCase();
        return getMediaTypeByExtension(extension);
    }

    /**
     * Get media type by file extension
     * @param {string} extension - File extension
     * @returns {string} Media type
     */
    function getMediaTypeByExtension(extension) {
        for (const [type, exts] of Object.entries(EXTENSIONS)) {
            if (exts.includes(extension)) {
                return type === 'animated_image' ? MEDIA_TYPES.ANIMATED_IMAGE : 
                       type === 'video' ? MEDIA_TYPES.VIDEO : 
                       MEDIA_TYPES.STATIC_IMAGE;
            }
        }
        return MEDIA_TYPES.STATIC_IMAGE;
    }

    /**
     * Check if URL is a YouTube URL
     * @param {string} url - URL to check
     * @returns {boolean} True if YouTube URL
     */
    function isYouTubeUrl(url) {
        return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(url);
    }

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - YouTube URL
     * @returns {string|null} Video ID or null
     */
    function getYouTubeVideoId(url) {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        return match ? match[1] : null;
    }

    /**
     * Create YouTube embed URL
     * @param {string} videoId - YouTube video ID
     * @returns {string} Embed URL
     */
    function createYouTubeEmbedUrl(videoId) {
        const params = new URLSearchParams({
            autoplay: extensionSettings.enableAutoplay ? '1' : '0',
            loop: extensionSettings.enableLoop ? '1' : '0',
            mute: extensionSettings.enableMute ? '1' : '0',
            playlist: extensionSettings.enableLoop ? videoId : '',
            controls: '0',
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
     * Create enhanced background container if it doesn't exist
     */
    function createBackgroundContainer() {
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
            `;
            
            // Insert before the original bg elements
            const bgCustom = document.getElementById('bg_custom');
            if (bgCustom) {
                bgCustom.parentNode.insertBefore(container, bgCustom);
            } else {
                document.body.appendChild(container);
            }
        }
        return container;
    }

    /**
     * Set animated background
     * @param {string} source - Background source (file path or URL)
     * @param {string} mediaType - Media type
     */
    function setAnimatedBackground(source, mediaType) {
        const container = createBackgroundContainer();
        
        // Clear existing content
        container.innerHTML = '';
        
        switch (mediaType) {
            case MEDIA_TYPES.VIDEO:
                setVideoBackground(container, source);
                break;
                
            case MEDIA_TYPES.YOUTUBE:
                setYouTubeBackground(container, source);
                break;
                
            case MEDIA_TYPES.ANIMATED_IMAGE:
                setAnimatedImageBackground(container, source);
                break;
                
            case MEDIA_TYPES.STATIC_IMAGE:
            default:
                setImageBackground(container, source);
                break;
        }
    }

    /**
     * Set video background
     * @param {HTMLElement} container - Background container
     * @param {string} source - Video source
     */
    function setVideoBackground(container, source) {
        const video = document.createElement('video');
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
        `;
        
        video.src = source;
        video.loop = extensionSettings.enableLoop;
        video.muted = extensionSettings.enableMute;
        video.volume = extensionSettings.enableMute ? 0 : extensionSettings.videoVolume;
        video.preload = extensionSettings.enablePreload ? 'auto' : 'metadata';
        
        if (extensionSettings.enableAutoplay) {
            video.autoplay = true;
        }
        
        // Error handling
        video.onerror = () => {
            console.error('Failed to load video background:', source);
            if (extensionSettings.fallbackToThumbnail) {
                setImageBackground(container, source);
            }
        };
        
        container.appendChild(video);
    }

    /**
     * Set YouTube background
     * @param {HTMLElement} container - Background container
     * @param {string} url - YouTube URL
     */
    function setYouTubeBackground(container, url) {
        const videoId = getYouTubeVideoId(url);
        if (!videoId) {
            console.error('Invalid YouTube URL:', url);
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
        
        iframe.src = createYouTubeEmbedUrl(videoId);
        iframe.allow = 'autoplay; encrypted-media';
        iframe.loading = 'lazy';
        
        container.appendChild(iframe);
    }

    /**
     * Set animated image background (GIF/WebP)
     * @param {HTMLElement} container - Background container
     * @param {string} source - Image source
     */
    function setAnimatedImageBackground(container, source) {
        const img = document.createElement('img');
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
        `;
        
        img.src = source;
        img.alt = 'Animated Background';
        
        img.onerror = () => {
            console.error('Failed to load animated image background:', source);
        };
        
        container.appendChild(img);
    }

    /**
     * Set static image background
     * @param {HTMLElement} container - Background container
     * @param {string} source - Image source
     */
    function setImageBackground(container, source) {
        container.style.backgroundImage = `url("${source}")`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
        container.style.backgroundRepeat = 'no-repeat';
    }

    /**
     * Hook into SillyTavern's background system
     */
    function hookIntoBackgroundSystem() {
        // Override the original setBackground function
        if (window.setBackground) {
            const originalSetBackground = window.setBackground;
            window.setBackground = function(bg, url, mediaType) {
                // Use enhanced media type detection if not provided
                if (!mediaType) {
                    mediaType = getEnhancedMediaType(bg || url);
                }
                
                // Use our enhanced background system for supported types
                if ([MEDIA_TYPES.VIDEO, MEDIA_TYPES.YOUTUBE, MEDIA_TYPES.ANIMATED_IMAGE].includes(mediaType)) {
                    setAnimatedBackground(url || bg, mediaType);
                    
                    // Still call original for compatibility
                    originalSetBackground.call(this, bg, url, mediaType);
                } else {
                    originalSetBackground.call(this, bg, url, mediaType);
                }
            };
        }
    }

    /**
     * Create settings panel for the extension
     */
    function createSettingsPanel() {
        const settingsHtml = `
            <div id="animated-backgrounds-settings" class="range-block">
                <h3>Animated Backgrounds Settings</h3>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-loop" ${extensionSettings.enableLoop ? 'checked' : ''}>
                        <span>Enable Loop for Videos</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-autoplay" ${extensionSettings.enableAutoplay ? 'checked' : ''}>
                        <span>Enable Autoplay</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-mute" ${extensionSettings.enableMute ? 'checked' : ''}>
                        <span>Mute Videos by Default</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label for="anim-bg-volume">Video Volume: <span id="anim-bg-volume-value">${Math.round(extensionSettings.videoVolume * 100)}%</span></label>
                    <input type="range" id="anim-bg-volume" min="0" max="1" step="0.1" value="${extensionSettings.videoVolume}">
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-preload" ${extensionSettings.enablePreload ? 'checked' : ''}>
                        <span>Preload Videos</span>
                    </label>
                </div>
                
                <div class="range-block">
                    <label class="checkbox_label">
                        <input type="checkbox" id="anim-bg-fallback" ${extensionSettings.fallbackToThumbnail ? 'checked' : ''}>
                        <span>Fallback to Thumbnail on Error</span>
                    </label>
                </div>
            </div>
        `;
        
        return settingsHtml;
    }

    /**
     * Bind settings events
     */
    function bindSettingsEvents() {
        $('#anim-bg-loop').on('change', function() {
            extensionSettings.enableLoop = this.checked;
            saveSettings();
        });
        
        $('#anim-bg-autoplay').on('change', function() {
            extensionSettings.enableAutoplay = this.checked;
            saveSettings();
        });
        
        $('#anim-bg-mute').on('change', function() {
            extensionSettings.enableMute = this.checked;
            saveSettings();
        });
        
        $('#anim-bg-volume').on('input', function() {
            extensionSettings.videoVolume = parseFloat(this.value);
            $('#anim-bg-volume-value').text(Math.round(this.value * 100) + '%');
            saveSettings();
        });
        
        $('#anim-bg-preload').on('change', function() {
            extensionSettings.enablePreload = this.checked;
            saveSettings();
        });
        
        $('#anim-bg-fallback').on('change', function() {
            extensionSettings.fallbackToThumbnail = this.checked;
            saveSettings();
        });
    }

    /**
     * Load extension settings
     */
    function loadSettings() {
        const saved = localStorage.getItem(EXTENSION_ID + '_settings');
        if (saved) {
            try {
                extensionSettings = Object.assign(extensionSettings, JSON.parse(saved));
            } catch (e) {
                console.warn('Failed to load animated backgrounds settings:', e);
            }
        }
    }

    /**
     * Save extension settings
     */
    function saveSettings() {
        localStorage.setItem(EXTENSION_ID + '_settings', JSON.stringify(extensionSettings));
    }

    /**
     * Initialize the extension
     */
    function initializeExtension() {
        console.log('Initializing Animated Backgrounds Extension');
        
        loadSettings();
        hookIntoBackgroundSystem();
        
        // Add settings to the extensions panel
        $(document).ready(function() {
            // Wait for SillyTavern to be ready
            const checkReady = setInterval(() => {
                if (typeof getRequestHeaders === 'function') {
                    clearInterval(checkReady);
                    
                    // Add settings panel to backgrounds section
                    const backgroundsSection = $('#Backgrounds');
                    if (backgroundsSection.length) {
                        backgroundsSection.append(createSettingsPanel());
                        bindSettingsEvents();
                    }
                }
            }, 500);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        initializeExtension();
    }

    // Export functions for testing/debugging
    window.AnimatedBackgrounds = {
        setAnimatedBackground,
        getEnhancedMediaType,
        extensionSettings
    };

})();