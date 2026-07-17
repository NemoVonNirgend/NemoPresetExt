/** UI affordances for the opt-in animated background feature. */

import logger from '../../core/logger.js';
import { LOG_PREFIX } from '../../core/utils.js';
import { animatedBackgrounds } from './animated-backgrounds-module.js';

const OWNED_SELECTOR = '[data-nemo-background-ui="true"]';

export class BackgroundUIEnhancements {
    constructor() {
        this.isInitialized = false;
        this.dragCounter = 0;
        this.cleanupFunctions = [];
        this.observers = new Set();
        this.timeouts = new Set();
        this.uploadButtonTitle = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        try {
            this.enhanceUploadArea();
            this.addDragAndDropSupport();
            this.addUrlPasteSupport();
            this.enhanceBackgroundPreview();
            logger.info(`${LOG_PREFIX} Background UI Enhancements initialized`);
        } catch (error) {
            this.destroy();
            logger.error(`${LOG_PREFIX} Failed to initialize Background UI Enhancements`, error);
        }
    }

    addListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.cleanupFunctions.push(() => target.removeEventListener(type, handler, options));
    }

    schedule(callback, delay = 0) {
        const timeout = setTimeout(() => {
            this.timeouts.delete(timeout);
            if (this.isInitialized) callback();
        }, delay);
        this.timeouts.add(timeout);
    }

    enhanceUploadArea() {
        const uploadButton = document.getElementById('add_background_button_top');
        if (!uploadButton || uploadButton.querySelector('.upload-instructions')) return;

        this.uploadButtonTitle = uploadButton.getAttribute('title');
        const hasVideoConverter = typeof globalThis.convertVideoToAnimatedWebp === 'function';
        uploadButton.title = hasVideoConverter
            ? 'Upload an image or video. SillyTavern will convert the video to animated WebP.'
            : 'Upload an image. Video uploads require the Video Background Loader add-on.';

        const instructions = document.createElement('span');
        instructions.className = 'upload-instructions';
        instructions.dataset.nemoBackgroundUi = 'true';
        instructions.dataset.videoConverterAvailable = String(hasVideoConverter);

        const hint = document.createElement('span');
        hint.className = 'upload-hint';
        const strong = document.createElement('strong');
        strong.textContent = hasVideoConverter ? 'Upload image or video' : 'Upload a background image';
        const detail = document.createElement('small');
        detail.textContent = hasVideoConverter
            ? 'Images upload directly; video files are converted to animated WebP'
            : 'Video files require the Video Background Loader add-on';
        hint.append(strong, document.createElement('br'), detail);
        instructions.appendChild(hint);
        uploadButton.appendChild(instructions);
    }

    addDragAndDropSupport() {
        const uploadArea = document.getElementById('bg_tabs');
        if (!uploadArea) return;

        const prevent = event => this.preventDefaults(event);
        for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
            this.addListener(uploadArea, type, prevent);
        }
        this.addListener(uploadArea, 'dragenter', () => this.highlightDropArea(uploadArea));
        this.addListener(uploadArea, 'dragover', () => uploadArea.classList.add('drag-over'));
        this.addListener(uploadArea, 'dragleave', () => this.unhighlightDropArea(uploadArea));
        this.addListener(uploadArea, 'drop', event => {
            this.dragCounter = 0;
            this.unhighlightDropArea(uploadArea);
            void this.handleDrop(event);
        });
    }

    preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    highlightDropArea(area) {
        this.dragCounter += 1;
        area.classList.add('drag-over');
    }

    unhighlightDropArea(area) {
        this.dragCounter = Math.max(0, this.dragCounter - 1);
        if (this.dragCounter === 0) area.classList.remove('drag-over');
    }

    async handleDrop(event) {
        const files = event.dataTransfer?.files;
        const fileInput = document.getElementById('add_bg_button');
        if (files?.length && fileInput instanceof HTMLInputElement) {
            const transfer = new DataTransfer();
            [...files].forEach(file => transfer.items.add(file));
            fileInput.files = transfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        const text = event.dataTransfer?.getData('text/plain')?.trim();
        if (text && animatedBackgrounds.isYouTubeUrl(text)) {
            await animatedBackgrounds.handleYouTubePaste(text);
        }
    }

    addUrlPasteSupport() {
        if (document.getElementById('bg-url-input')) return;
        const header = document.getElementById('bg-header-fixed');
        if (!header) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'nemo-background-url-row';
        wrapper.dataset.nemoBackgroundUi = 'true';
        const label = document.createElement('label');
        label.htmlFor = 'bg-url-input';
        label.className = 'sr-only';
        label.textContent = 'YouTube background URL';
        const input = document.createElement('input');
        input.type = 'url';
        input.id = 'bg-url-input';
        input.className = 'text_pole';
        input.placeholder = 'Paste a YouTube background URL';
        input.autocomplete = 'off';
        wrapper.append(label, input);
        header.appendChild(wrapper);

        const submit = async () => {
            const value = input.value.trim();
            if (!value) return;
            if (await animatedBackgrounds.handleYouTubePaste(value)) input.value = '';
        };
        this.addListener(input, 'keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
            }
        });
        this.addListener(input, 'paste', () => this.schedule(() => void submit()));
    }

    enhanceBackgroundPreview() {
        for (const id of ['bg_menu_content', 'bg_custom_content']) {
            const container = document.getElementById(id);
            if (!container) continue;
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (!(node instanceof Element)) continue;
                        if (node.matches('.bg_example')) this.addMediaTypeIndicator(node);
                        node.querySelectorAll?.('.bg_example').forEach(item => this.addMediaTypeIndicator(item));
                    }
                }
            });
            observer.observe(container, { childList: true, subtree: true });
            this.observers.add(observer);
            container.querySelectorAll('.bg_example').forEach(item => this.addMediaTypeIndicator(item));
        }
    }

    addMediaTypeIndicator(background) {
        if (background.querySelector('.media-type-indicator')) return;
        const source = background.dataset.favoriteUrl || background.getAttribute('bgfile');
        if (!source) return;
        const type = animatedBackgrounds.getEnhancedMediaType(source);
        const metadata = {
            [animatedBackgrounds.MEDIA_TYPES.VIDEO]: ['fa-solid fa-video', 'Video background'],
            [animatedBackgrounds.MEDIA_TYPES.YOUTUBE]: ['fa-brands fa-youtube', 'YouTube background'],
            [animatedBackgrounds.MEDIA_TYPES.ANIMATED_IMAGE]: ['fa-solid fa-film', 'Animated background'],
        }[type];
        if (!metadata) return;

        const indicator = document.createElement('span');
        indicator.className = 'media-type-indicator';
        indicator.dataset.nemoBackgroundUi = 'true';
        indicator.dataset.mediaType = type;
        indicator.title = metadata[1];
        indicator.setAttribute('aria-label', metadata[1]);
        const icon = document.createElement('i');
        icon.className = metadata[0];
        icon.setAttribute('aria-hidden', 'true');
        indicator.appendChild(icon);
        background.appendChild(indicator);
    }

    addMediaTypeIndicators() {
        document.querySelectorAll('.bg_example').forEach(item => this.addMediaTypeIndicator(item));
    }

    addEnhancedStyles() {
        // Styles are loaded by AnimatedBackgroundsModule.
    }

    destroy() {
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
        this.cleanupFunctions.splice(0).forEach(cleanup => cleanup());
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        document.querySelectorAll(OWNED_SELECTOR).forEach(element => element.remove());
        document.getElementById('bg_tabs')?.classList.remove('drag-over');
        const uploadButton = document.getElementById('add_background_button_top');
        if (uploadButton && this.uploadButtonTitle !== null) {
            uploadButton.setAttribute('title', this.uploadButtonTitle);
        }
        this.uploadButtonTitle = null;
        this.dragCounter = 0;
        this.isInitialized = false;
    }
}

export const backgroundUIEnhancements = new BackgroundUIEnhancements();
