/**
 * Background UI Enhancements
 * Provides enhanced UI for animated backgrounds functionality
 */

import logger from './logger.js';
import { LOG_PREFIX } from './utils.js';
import { animatedBackgrounds } from './animated-backgrounds-module.js';

export class BackgroundUIEnhancements {
    constructor() {
        this.isInitialized = false;
        this.dragCounter = 0;
    }

    /**
     * Initialize UI enhancements
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn(`${LOG_PREFIX} Background UI Enhancements already initialized`);
            return;
        }

        try {
            logger.info(`${LOG_PREFIX} Initializing Background UI Enhancements...`);
            
            this.enhanceUploadArea();
            this.addDragAndDropSupport();
            this.enhanceBackgroundPreview();
            this.addUrlPasteSupport();
            this.addMediaTypeIndicators();
            
            this.isInitialized = true;
            logger.info(`${LOG_PREFIX} Background UI Enhancements initialized successfully`);
        } catch (error) {
            logger.error(`${LOG_PREFIX} Failed to initialize Background UI Enhancements:`, error);
        }
    }

    /**
     * Enhance the upload area with better visuals and instructions
     */
    enhanceUploadArea() {
        const uploadForm = document.getElementById('form_bg_download');
        if (!uploadForm) {
            logger.warn(`${LOG_PREFIX} Upload form not found`);
            return;
        }

        // Add enhanced styling
        uploadForm.style.position = 'relative';
        
        // Create enhanced upload button
        const uploadButton = uploadForm.querySelector('.add_bg_but');
        if (uploadButton) {
            uploadButton.title = 'Upload Video (MP4, WebM), Animated Image (GIF, WebP), or Static Image\nOr paste a YouTube URL';
            
            // Add hover instructions
            const instructions = document.createElement('div');
            instructions.className = 'upload-instructions';
            instructions.innerHTML = `
                <div class="upload-hint">
                    <strong>Drag & Drop or Click to Upload</strong><br>
                    <small>MP4, WebM, GIF, WebP, JPG, PNG</small><br>
                    <small>Or paste YouTube URL</small>
                </div>
            `;
            
            uploadButton.appendChild(instructions);
        }
    }

    /**
     * Add drag and drop support for files and URLs
     */
    addDragAndDropSupport() {
        const uploadArea = document.getElementById('bg_menu_content');
        if (!uploadArea) {
            logger.warn(`${LOG_PREFIX} Background menu content not found`);
            return;
        }

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => this.highlightDropArea(uploadArea), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => this.unhighlightDropArea(uploadArea), false);
        });

        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    /**
     * Prevent default drag behaviors
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Highlight drop area
     */
    highlightDropArea(area) {
        this.dragCounter++;
        area.classList.add('drag-over');
    }

    /**
     * Unhighlight drop area
     */
    unhighlightDropArea(area) {
        this.dragCounter--;
        if (this.dragCounter === 0) {
            area.classList.remove('drag-over');
        }
    }

    /**
     * Handle dropped files
     */
    async handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        const text = dt.getData('text');

        if (files.length > 0) {
            // Handle file drop
            const file = files[0];
            const mediaType = animatedBackgrounds.getEnhancedMediaType(file.name);
            
            logger.info(`${LOG_PREFIX} File dropped:`, file.name, 'Type:', mediaType);
            
            // For video files, handle directly through our extension
            if (mediaType === animatedBackgrounds.MEDIA_TYPES.VIDEO) {
                const fileInput = document.getElementById('add_bg_button');
                if (fileInput && animatedBackgrounds.handleVideoUpload) {
                    await animatedBackgrounds.handleVideoUpload(file, fileInput);
                    return;
                }
            }
            
            // For non-video files, use the standard upload process
            const fileInput = document.getElementById('add_bg_button');
            if (fileInput) {
                // Create a new FileList with the dropped file
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Trigger change event
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            toastr.info(`Processing ${mediaType} background: ${file.name}`);
        } else if (text && animatedBackgrounds.isYouTubeUrl(text)) {
            // Handle YouTube URL drop
            logger.info(`${LOG_PREFIX} YouTube URL dropped:`, text);
            animatedBackgrounds.handleYouTubePaste(text);
        }
    }

    /**
     * Add URL paste support
     */
    addUrlPasteSupport() {
        // Create a hidden input for URL pasting
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.id = 'bg-url-input';
        urlInput.placeholder = 'Paste YouTube URL here...';
        urlInput.style.cssText = `
            width: 100%;
            padding: 8px;
            margin: 10px 0;
            border: 1px solid #555;
            background: #333;
            color: #ddd;
            border-radius: 4px;
            font-size: 12px;
        `;

        // Add to backgrounds section
        const backgroundsSection = document.getElementById('Backgrounds');
        if (backgroundsSection) {
            const bgMenuContent = backgroundsSection.querySelector('#bg_menu_content');
            if (bgMenuContent) {
                bgMenuContent.insertAdjacentElement('beforebegin', urlInput);
            }
        }

        // Handle URL input
        urlInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                const url = e.target.value.trim();
                if (animatedBackgrounds.isYouTubeUrl(url)) {
                    animatedBackgrounds.handleYouTubePaste(url);
                    e.target.value = '';
                } else if (url) {
                    toastr.warning('Please paste a valid YouTube URL');
                }
            }, 100);
        });

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value.trim();
                if (animatedBackgrounds.isYouTubeUrl(url)) {
                    animatedBackgrounds.handleYouTubePaste(url);
                    e.target.value = '';
                } else if (url) {
                    toastr.warning('Please enter a valid YouTube URL');
                }
            }
        });
    }

    /**
     * Enhance background preview with media type indicators
     */
    enhanceBackgroundPreview() {
        // Use MutationObserver to watch for new backgrounds being added
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('bg_example')) {
                        this.addMediaTypeIndicator(node);
                    }
                });
            });
        });

        // Observe both system and custom background containers
        const systemBgs = document.getElementById('bg_menu_content');
        const customBgs = document.getElementById('bg_custom_content');
        
        if (systemBgs) {
            observer.observe(systemBgs, { childList: true });
            
            // Add indicators to existing backgrounds
            systemBgs.querySelectorAll('.bg_example').forEach(bg => {
                this.addMediaTypeIndicator(bg);
            });
        }
        
        if (customBgs) {
            observer.observe(customBgs, { childList: true });
            
            // Add indicators to existing backgrounds
            customBgs.querySelectorAll('.bg_example').forEach(bg => {
                this.addMediaTypeIndicator(bg);
            });
        }
    }

    /**
     * Add media type indicator to background element
     */
    addMediaTypeIndicator(bgElement) {
        if (bgElement.querySelector('.media-type-indicator')) {
            return; // Already has indicator
        }

        const bgFile = bgElement.getAttribute('bgfile');
        if (!bgFile) return;

        const mediaType = animatedBackgrounds.getEnhancedMediaType(bgFile);
        
        if (mediaType !== animatedBackgrounds.MEDIA_TYPES.STATIC_IMAGE) {
            const indicator = document.createElement('div');
            indicator.className = 'media-type-indicator';
            indicator.setAttribute('data-media-type', mediaType);
            
            let icon, label, color;
            switch (mediaType) {
                case animatedBackgrounds.MEDIA_TYPES.VIDEO:
                    icon = '🎥';
                    label = 'Video';
                    color = '#f44336';
                    break;
                case animatedBackgrounds.MEDIA_TYPES.YOUTUBE:
                    icon = '📺';
                    label = 'YouTube';
                    color = '#ff0000';
                    break;
                case animatedBackgrounds.MEDIA_TYPES.ANIMATED_IMAGE:
                    icon = '🎬';
                    label = 'Animated';
                    color = '#4CAF50';
                    break;
                default:
                    return;
            }
            
            indicator.innerHTML = `<span class="indicator-icon">${icon}</span>`;
            indicator.title = `${label} Background`;
            indicator.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: ${color};
                color: white;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                z-index: 10;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            
            bgElement.style.position = 'relative';
            bgElement.appendChild(indicator);
        }
    }

    /**
     * Add media type indicators to existing backgrounds
     */
    addMediaTypeIndicators() {
        // Wait for backgrounds to load
        const checkForBackgrounds = setInterval(() => {
            const backgrounds = document.querySelectorAll('.bg_example');
            if (backgrounds.length > 0) {
                clearInterval(checkForBackgrounds);
                backgrounds.forEach(bg => this.addMediaTypeIndicator(bg));
            }
        }, 1000);
    }

    /**
     * Add enhanced styles
     */
    addEnhancedStyles() {
        const style = document.createElement('style');
        style.id = 'background-ui-enhancements-css';
        style.textContent = `
            /* Drag and drop styling */
            .drag-over {
                border: 2px dashed #4CAF50 !important;
                background: rgba(76, 175, 80, 0.1) !important;
                border-radius: 8px !important;
            }

            /* Upload instructions */
            .upload-instructions {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
                z-index: 100;
                min-width: 200px;
            }

            .add_bg_but:hover .upload-instructions {
                opacity: 1;
            }

            .upload-hint strong {
                color: #4CAF50;
                font-size: 14px;
            }

            .upload-hint small {
                display: block;
                margin-top: 4px;
                color: #ccc;
                font-size: 11px;
            }

            /* Media type indicators */
            .media-type-indicator {
                animation: fadeIn 0.3s ease-in;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }

            .media-type-indicator:hover {
                transform: scale(1.1);
                transition: transform 0.2s;
            }

            /* URL input styling */
            #bg-url-input:focus {
                border-color: #4CAF50;
                outline: none;
                box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
            }

            /* Enhanced background preview */
            .bg_example {
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .bg_example:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
        `;

        document.head.appendChild(style);
    }
}

// Create and export a singleton instance
export const backgroundUIEnhancements = new BackgroundUIEnhancements();