/**
 * Opt-in video and YouTube backgrounds for NemoPresetExt.
 *
 * SillyTavern owns image uploads, animated image conversion, fitting, and chat
 * metadata. This module integrates through public events and extension-owned
 * DOM instead of patching private SillyTavern functions.
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import logger from '../../core/logger.js';
import { LOG_PREFIX, getExtensionPath } from '../../core/utils.js';

const SETTINGS_KEY = 'animatedBackgrounds';
const FAVORITES_KEY = 'animated-bg-favorites';
const PLAYLIST_KEY = 'animated-bg-playlist';
const OWNED_FAVORITE_SELECTOR = '[data-nemo-animated-favorite="true"]';
const ALLOWED_FITTING = new Set(['cover', 'contain', 'fill', 'none', 'scale-down']);

function createIcon(className) {
    const icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

function createIconButton(id, title, iconClass) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.appendChild(createIcon(iconClass));
    return button;
}

function readStoredArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (error) {
        logger.warn(`${LOG_PREFIX} Ignoring invalid ${key} data`, error);
        return [];
    }
}

function saveStoredArray(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        logger.warn(`${LOG_PREFIX} Could not persist ${key}`, error);
    }
}

export class AnimatedBackgroundsModule {
    constructor() {
        this.MEDIA_TYPES = Object.freeze({
            VIDEO: 'video',
            ANIMATED_IMAGE: 'animated_image',
            STATIC_IMAGE: 'image',
            YOUTUBE: 'youtube',
            EMBED: 'embed',
        });
        this.EXTENSIONS = Object.freeze({
            video: ['mp4', 'webm', 'ogv', 'mov'],
            animated_image: ['gif', 'webp', 'apng'],
        });
        this.defaultSettings = Object.freeze({
            enabled: true,
            enableLoop: true,
            enableAutoplay: true,
            enableMute: true,
            videoVolume: 0.1,
            enablePreload: true,
            fallbackToThumbnail: false,
            backgroundFitting: 'cover',
        });
        this.isInitialized = false;
        this.backgroundContainer = null;
        this.currentBackground = null;
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        this.nativeBackgroundSnapshot = null;
        this.nativeBackgroundObserver = null;
        this.eventHandlers = [];
        this.domHandlers = [];
        this.timeouts = new Set();
        this.favorites = readStoredArray(FAVORITES_KEY);
        this.playlist = {
            items: readStoredArray(PLAYLIST_KEY),
            currentIndex: -1,
            shuffle: false,
            repeat: false,
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        try {
            this.ensureSettings();
            this.loadCSS();
            this.createBackgroundContainer();
            this.setupEventListeners();
            this.observeNativeBackgroundHost();
            this.schedule(() => this.loadFavoritesIntoBackgroundUI(), 500);
            logger.info(`${LOG_PREFIX} Animated Backgrounds initialized`);
        } catch (error) {
            this.destroy();
            logger.error(`${LOG_PREFIX} Failed to initialize Animated Backgrounds`, error);
        }
    }

    ensureSettings() {
        extension_settings.NemoPresetExt ??= {};
        const saved = extension_settings.NemoPresetExt[SETTINGS_KEY];
        extension_settings.NemoPresetExt[SETTINGS_KEY] = {
            ...this.defaultSettings,
            ...(saved && typeof saved === 'object' ? saved : {}),
        };
    }

    getSettings() {
        return extension_settings.NemoPresetExt?.[SETTINGS_KEY] ?? { ...this.defaultSettings };
    }

    saveSettings() {
        saveSettingsDebounced();
    }

    schedule(callback, delay) {
        const timeout = setTimeout(() => {
            this.timeouts.delete(timeout);
            if (this.isInitialized) callback();
        }, delay);
        this.timeouts.add(timeout);
        return timeout;
    }

    addDomHandler(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.domHandlers.push(() => target.removeEventListener(type, handler, options));
    }

    addEventHandler(type, handler) {
        eventSource.on(type, handler);
        this.eventHandlers.push(() => eventSource.removeListener(type, handler));
    }

    loadCSS() {
        if (document.getElementById('animated-backgrounds-css')) return;
        const link = document.createElement('link');
        link.id = 'animated-backgrounds-css';
        link.rel = 'stylesheet';
        link.href = getExtensionPath('features/backgrounds/animated-backgrounds.css');
        document.head.appendChild(link);
    }

    getEnhancedMediaType(fileName) {
        const value = String(fileName ?? '').trim();
        if (!value) return this.MEDIA_TYPES.STATIC_IMAGE;
        if (this.isYouTubeUrl(value)) return this.MEDIA_TYPES.YOUTUBE;
        let path = value;
        try {
            path = new URL(value, document.baseURI).pathname;
        } catch {
            // Relative SillyTavern background paths are valid input.
        }
        return this.getMediaTypeByExtension(path.split('.').pop()?.toLowerCase());
    }

    getMediaTypeByExtension(extension) {
        const value = String(extension ?? '').toLowerCase();
        if (this.EXTENSIONS.video.includes(value)) return this.MEDIA_TYPES.VIDEO;
        if (this.EXTENSIONS.animated_image.includes(value)) return this.MEDIA_TYPES.ANIMATED_IMAGE;
        return this.MEDIA_TYPES.STATIC_IMAGE;
    }

    getYouTubeVideoId(value) {
        try {
            const url = new URL(String(value));
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            let id = null;
            if (host === 'youtu.be') {
                id = url.pathname.split('/').filter(Boolean)[0];
            } else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
                const parts = url.pathname.split('/').filter(Boolean);
                id = url.searchParams.get('v');
                if (!id && ['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
            }
            return /^[\w-]{11}$/.test(id ?? '') ? id : null;
        } catch {
            return null;
        }
    }

    isYouTubeUrl(value) {
        return this.getYouTubeVideoId(value) !== null;
    }

    createYouTubeEmbedUrl(videoId) {
        if (!/^[\w-]{11}$/.test(videoId)) return '';
        const settings = this.getSettings();
        const params = new URLSearchParams({
            autoplay: settings.enableAutoplay ? '1' : '0',
            loop: settings.enableLoop ? '1' : '0',
            mute: settings.enableMute ? '1' : '0',
            controls: '0',
            playsinline: '1',
            rel: '0',
            modestbranding: '1',
        });
        if (settings.enableLoop) params.set('playlist', videoId);
        return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
    }

    createBackgroundContainer() {
        let container = document.getElementById('enhanced-background-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'enhanced-background-container';
            container.setAttribute('aria-hidden', 'true');
            Object.assign(container.style, {
                position: 'fixed', inset: '0', overflow: 'hidden',
                pointerEvents: 'none', zIndex: '-1',
            });
            const nativeBackground = document.getElementById('bg1');
            (nativeBackground?.parentNode ?? document.body).insertBefore(container, nativeBackground ?? null);
        }
        this.backgroundContainer = container;
        return container;
    }

    hideNativeBackground() {
        const element = document.getElementById('bg1');
        if (!element) return;
        if (!this.nativeBackgroundSnapshot || this.nativeBackgroundSnapshot.element !== element) {
            this.nativeBackgroundSnapshot = { element, visibility: element.style.visibility };
        }
        element.style.visibility = 'hidden';
    }

    restoreNativeBackground() {
        const snapshot = this.nativeBackgroundSnapshot;
        if (snapshot?.element) snapshot.element.style.visibility = snapshot.visibility;
        this.nativeBackgroundSnapshot = null;
    }

    setAnimatedBackground(source, mediaType = this.getEnhancedMediaType(source)) {
        const value = String(source ?? '').trim();
        if (!this.getSettings().enabled || !value) return false;
        const supported = new Set(Object.values(this.MEDIA_TYPES));
        const type = supported.has(mediaType) ? mediaType : this.getEnhancedMediaType(value);
        const container = this.createBackgroundContainer();
        this.stopCurrentMedia();
        container.replaceChildren();
        container.classList.add('bg-loading');
        this.hideNativeBackground();
        this.currentBackground = { source: value, mediaType: type };

        if (type === this.MEDIA_TYPES.VIDEO) this.setVideoBackground(container, value);
        else if (type === this.MEDIA_TYPES.YOUTUBE) this.setYouTubeBackground(container, value);
        else this.setImageBackground(container, value);
        return true;
    }

    applyMediaLayout(element) {
        const nativeFitting = document.getElementById('background_fitting')?.value;
        const fitting = ({
            classic: 'cover', stretch: 'fill', center: 'none',
        })[nativeFitting] ?? nativeFitting ?? this.getSettings().backgroundFitting;
        Object.assign(element.style, {
            position: 'absolute', inset: '0', width: '100%', height: '100%',
            objectFit: ALLOWED_FITTING.has(fitting) ? fitting : 'cover',
        });
    }

    setVideoBackground(container, source) {
        const settings = this.getSettings();
        const video = document.createElement('video');
        this.applyMediaLayout(video);
        video.src = source;
        video.loop = Boolean(settings.enableLoop);
        video.muted = Boolean(settings.enableMute);
        video.volume = settings.enableMute ? 0 : Math.min(1, Math.max(0, Number(settings.videoVolume) || 0));
        video.preload = settings.enablePreload ? 'auto' : 'metadata';
        video.autoplay = Boolean(settings.enableAutoplay);
        video.playsInline = true;
        video.addEventListener('loadeddata', () => container.classList.remove('bg-loading'), { once: true });
        video.addEventListener('loadedmetadata', () => this.showVideoControls(), { once: true });
        video.addEventListener('error', () => {
            container.classList.remove('bg-loading');
            logger.error(`${LOG_PREFIX} Video background failed to load`, source);
            if (settings.fallbackToThumbnail) this.clearAnimatedBackground();
        }, { once: true });
        this.currentVideoElement = video;
        container.appendChild(video);
        if (video.autoplay) void video.play().catch(() => undefined);
    }

    setYouTubeBackground(container, url) {
        const videoId = this.getYouTubeVideoId(url);
        const source = videoId && this.createYouTubeEmbedUrl(videoId);
        if (!source) {
            this.clearAnimatedBackground();
            return;
        }
        const iframe = document.createElement('iframe');
        this.applyMediaLayout(iframe);
        iframe.src = source;
        iframe.title = 'YouTube background';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.tabIndex = -1;
        iframe.style.border = '0';
        iframe.addEventListener('load', () => container.classList.remove('bg-loading'), { once: true });
        container.appendChild(iframe);
        this.currentVideoElement = iframe;
        this.youtubePlayer = iframe;
    }

    setAnimatedImageBackground(container, source) {
        this.setImageBackground(container, source);
    }

    setImageBackground(container, source) {
        const image = document.createElement('img');
        this.applyMediaLayout(image);
        image.src = source;
        image.alt = '';
        image.addEventListener('load', () => container.classList.remove('bg-loading'), { once: true });
        image.addEventListener('error', () => container.classList.remove('bg-loading'), { once: true });
        container.appendChild(image);
    }

    switchToTransparentBackground() {
        this.hideNativeBackground();
    }

    setupEventListeners() {
        const clearForNativeBackground = () => {
            this.clearAnimatedBackground();
            this.schedule(() => this.loadFavoritesIntoBackgroundUI(), 0);
        };
        eventSource.on(event_types.CHAT_CHANGED, clearForNativeBackground);
        this.eventHandlers.push(() => eventSource.removeListener(event_types.CHAT_CHANGED, clearForNativeBackground));
        eventSource.on(event_types.FORCE_SET_BACKGROUND, clearForNativeBackground);
        this.eventHandlers.push(() => eventSource.removeListener(
            event_types.FORCE_SET_BACKGROUND, clearForNativeBackground,
        ));

        this.addDomHandler(document, 'click', event => {
            const target = event.target instanceof Element ? event.target.closest('.bg_example') : null;
            if (target && target.dataset.nemoAnimatedFavorite !== 'true') {
                this.schedule(() => this.clearAnimatedBackground(), 0);
            }
        });

        const fitting = document.getElementById('background_fitting');
        if (fitting) {
            this.addDomHandler(fitting, 'input', () => {
                const current = this.backgroundContainer?.firstElementChild;
                if (current instanceof HTMLElement) this.applyMediaLayout(current);
            });
        }
    }

    observeNativeBackgroundHost() {
        this.nativeBackgroundObserver?.disconnect();
        this.nativeBackgroundObserver = new MutationObserver(mutations => {
            if (!this.currentBackground) return;
            const replaced = mutations.some(mutation =>
                [...mutation.addedNodes, ...mutation.removedNodes]
                    .some(node => node instanceof Element && node.id === 'bg1'));
            if (replaced) this.clearAnimatedBackground();
        });
        this.nativeBackgroundObserver.observe(document.body, { childList: true });
    }

    async handleVideoUpload(file, inputElement = document.getElementById('add_bg_button')) {
        if (!(file instanceof File) || !(inputElement instanceof HTMLInputElement)) return false;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        inputElement.files = transfer.files;
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    addToPlaylist(source, mediaType, metadata = {}) {
        const item = {
            id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            source: String(source),
            mediaType: mediaType || this.getEnhancedMediaType(source),
            title: String(metadata.title || this.extractTitleFromSource(source)),
            thumbnail: String(metadata.thumbnail || ''),
        };
        this.playlist.items.push(item);
        if (this.playlist.currentIndex < 0) this.playlist.currentIndex = 0;
        this.savePlaylist();
        return item;
    }

    removeFromPlaylist(itemId) {
        const index = this.playlist.items.findIndex(item => item.id === itemId);
        if (index < 0) return false;
        this.playlist.items.splice(index, 1);
        this.playlist.currentIndex = Math.min(this.playlist.currentIndex, this.playlist.items.length - 1);
        this.savePlaylist();
        return true;
    }

    getCurrentPlaylistItem() {
        return this.playlist.items[this.playlist.currentIndex] ?? null;
    }

    playPlaylistItem(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.playlist.items.length) return false;
        this.playlist.currentIndex = index;
        const item = this.playlist.items[index];
        this.setAnimatedBackground(item.source, item.mediaType);
        this.savePlaylist();
        return true;
    }

    playNext() {
        if (!this.playlist.items.length) return false;
        const next = this.playlist.shuffle
            ? Math.floor(Math.random() * this.playlist.items.length)
            : (this.playlist.currentIndex + 1) % this.playlist.items.length;
        return this.playPlaylistItem(next);
    }

    playPrevious() {
        if (!this.playlist.items.length) return false;
        return this.playPlaylistItem((this.playlist.currentIndex - 1 + this.playlist.items.length) % this.playlist.items.length);
    }

    savePlaylist() {
        saveStoredArray(PLAYLIST_KEY, this.playlist.items);
    }

    loadPlaylist() {
        this.playlist.items = readStoredArray(PLAYLIST_KEY);
        this.playlist.currentIndex = this.playlist.items.length ? 0 : -1;
    }

    clearPlaylist() {
        this.playlist.items = [];
        this.playlist.currentIndex = -1;
        this.savePlaylist();
    }

    updatePlaylistControls() {
        document.querySelectorAll('.playlist-count').forEach(badge => {
            badge.textContent = String(this.playlist.items.length);
        });
    }

    extractTitleFromSource(source) {
        try {
            const url = new URL(String(source), document.baseURI);
            return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname);
        } catch {
            return String(source).split('/').pop() || 'Untitled';
        }
    }

    updateCurrentVideoProperties(settings = this.getSettings()) {
        const media = this.currentVideoElement;
        if (!settings.enabled) {
            this.clearAnimatedBackground();
            return;
        }
        if (media instanceof HTMLVideoElement) {
            media.loop = Boolean(settings.enableLoop);
            media.muted = Boolean(settings.enableMute);
            media.volume = settings.enableMute ? 0 : Math.min(1, Math.max(0, Number(settings.videoVolume) || 0));
            this.applyMediaLayout(media);
        } else if (this.currentBackground?.mediaType === this.MEDIA_TYPES.YOUTUBE) {
            this.setAnimatedBackground(this.currentBackground.source, this.MEDIA_TYPES.YOUTUBE);
        } else if (media instanceof HTMLElement) {
            this.applyMediaLayout(media);
        }
    }

    getCurrentVideoElement() { return this.currentVideoElement; }
    hasCurrentVideo() { return Boolean(this.currentBackground); }

    showVideoControls() {
        this.hideVideoControls();
        const video = this.currentVideoElement;
        if (!(video instanceof HTMLVideoElement)) return;
        const controls = document.createElement('div');
        controls.id = 'enhanced-video-controls';
        controls.className = 'enhanced-bg-controls visible';
        const play = createIconButton('video-play-pause', 'Play or pause', video.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause');
        const mute = createIconButton('video-mute', 'Mute or unmute', video.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high');
        const favorite = createIconButton('video-favorite', 'Add to favorites', 'fa-regular fa-heart');
        const close = createIconButton('video-controls-close', 'Return to SillyTavern background', 'fa-solid fa-xmark');
        const volume = document.createElement('input');
        volume.type = 'range';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.05';
        volume.value = String(video.muted ? 0 : video.volume);
        volume.setAttribute('aria-label', 'Video volume');
        play.addEventListener('click', () => {
            if (video.paused) void video.play().catch(() => undefined);
            else video.pause();
            play.replaceChildren(createIcon(video.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause'));
        });
        mute.addEventListener('click', () => {
            video.muted = !video.muted;
            mute.replaceChildren(createIcon(video.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high'));
        });
        volume.addEventListener('input', () => {
            video.volume = Number(volume.value);
            video.muted = video.volume === 0;
        });
        close.addEventListener('click', () => this.clearAnimatedBackground());
        controls.append(play, mute, volume, favorite, close);
        document.body.appendChild(controls);
        this.updateFavoriteButton(this.isCurrentVideoFavorited());
    }

    showYouTubeControls() {}
    hideVideoControls() { document.getElementById('enhanced-video-controls')?.remove(); }
    showRestoreControlsButton() {}
    hideRestoreControlsButton() { document.getElementById('show-video-controls')?.remove(); }
    showCurrentVideoControls() { this.showVideoControls(); }

    stopCurrentMedia() {
        if (this.currentVideoElement instanceof HTMLVideoElement) {
            this.currentVideoElement.pause();
            this.currentVideoElement.removeAttribute('src');
            this.currentVideoElement.load();
        }
        this.currentVideoElement = null;
        this.youtubePlayer = null;
        this.hideVideoControls();
        this.hideRestoreControlsButton();
    }

    clearAnimatedBackground() {
        this.stopCurrentMedia();
        this.backgroundContainer?.replaceChildren();
        this.backgroundContainer?.classList.remove('bg-loading');
        this.currentBackground = null;
        this.restoreNativeBackground();
    }

    loadFavorites() {
        this.favorites = readStoredArray(FAVORITES_KEY);
        return this.favorites;
    }

    saveFavorites() { saveStoredArray(FAVORITES_KEY, this.favorites); }

    async addToFavorites() {
        if (!this.currentBackground) return false;
        const { source, mediaType } = this.currentBackground;
        if (this.favorites.some(favorite => favorite.url === source)) return false;
        const videoId = mediaType === this.MEDIA_TYPES.YOUTUBE ? this.getYouTubeVideoId(source) : null;
        const favorite = {
            url: source,
            type: mediaType,
            title: videoId ? `YouTube video (${videoId})` : this.extractTitleFromSource(source),
            thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '',
        };
        this.favorites.push(favorite);
        this.saveFavorites();
        this.addFavoriteToBackgroundUI(favorite);
        this.updateFavoriteButton(true);
        return true;
    }

    removeFromFavorites(url) {
        const index = this.favorites.findIndex(favorite => favorite.url === url);
        if (index < 0) return false;
        this.favorites.splice(index, 1);
        this.saveFavorites();
        this.removeFavoriteFromBackgroundUI(url);
        this.updateFavoriteButton(false);
        return true;
    }

    isCurrentVideoFavorited() {
        return Boolean(this.currentBackground
            && this.favorites.some(favorite => favorite.url === this.currentBackground.source));
    }

    updateFavoriteButton(isFavorited) {
        const button = document.getElementById('video-favorite');
        if (!button) return;
        button.replaceChildren(createIcon(isFavorited ? 'fa-solid fa-heart' : 'fa-regular fa-heart'));
        button.title = isFavorited ? 'Remove from favorites' : 'Add to favorites';
        button.onclick = isFavorited
            ? () => this.removeFromFavorites(this.currentBackground?.source)
            : () => void this.addToFavorites();
    }

    addFavoriteToBackgroundUI(favoriteData) {
        const list = document.getElementById('bg_custom_content');
        if (!list || !favoriteData?.url) return;
        if ([...list.querySelectorAll(OWNED_FAVORITE_SELECTOR)]
            .some(item => item.dataset.favoriteUrl === favoriteData.url)) return;
        const item = document.createElement('div');
        item.className = 'bg_example nemo-animated-background-favorite';
        item.dataset.nemoAnimatedFavorite = 'true';
        item.dataset.favoriteUrl = String(favoriteData.url);
        item.dataset.mediaType = String(favoriteData.type || this.getEnhancedMediaType(favoriteData.url));
        item.title = String(favoriteData.title || this.extractTitleFromSource(favoriteData.url));
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        if (favoriteData.thumbnail) {
            item.style.backgroundImage = `url(${JSON.stringify(String(favoriteData.thumbnail))})`;
        }
        const heart = document.createElement('span');
        heart.className = 'favorite-indicator';
        heart.appendChild(createIcon('fa-solid fa-heart'));
        item.appendChild(heart);
        const activate = event => {
            event.preventDefault();
            event.stopPropagation();
            this.setAnimatedBackground(favoriteData.url, favoriteData.type);
        };
        item.addEventListener('click', activate);
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') activate(event);
        });
        list.prepend(item);
    }

    removeFavoriteFromBackgroundUI(url) {
        document.querySelectorAll(OWNED_FAVORITE_SELECTOR).forEach(item => {
            if (item.dataset.favoriteUrl === url) item.remove();
        });
    }

    loadFavoritesIntoBackgroundUI() {
        document.querySelectorAll(OWNED_FAVORITE_SELECTOR).forEach(item => item.remove());
        [...this.favorites].reverse().forEach(favorite => this.addFavoriteToBackgroundUI(favorite));
    }

    async handleYouTubePaste(url) {
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) {
            globalThis.toastr?.warning?.('Please enter a valid YouTube URL');
            return false;
        }
        const normalized = `https://www.youtube.com/watch?v=${videoId}`;
        const metadata = {
            title: `YouTube video (${videoId})`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        };
        let index = this.playlist.items.findIndex(item => item.source === normalized);
        if (index < 0) {
            const item = this.addToPlaylist(normalized, this.MEDIA_TYPES.YOUTUBE, metadata);
            index = this.playlist.items.indexOf(item);
        }
        if (!this.favorites.some(favorite => favorite.url === normalized)) {
            this.favorites.push({ url: normalized, type: this.MEDIA_TYPES.YOUTUBE, ...metadata });
            this.saveFavorites();
            this.addFavoriteToBackgroundUI(this.favorites.at(-1));
        }
        return this.playPlaylistItem(index);
    }

    createSettingsUI() {
        const settings = this.getSettings();
        const panel = document.createElement('section');
        panel.id = 'animated-backgrounds-settings';
        panel.className = 'range-block';
        const heading = document.createElement('h3');
        heading.textContent = 'Animated backgrounds';
        panel.appendChild(heading);

        const addCheckbox = (id, text, key) => {
            const label = document.createElement('label');
            label.className = 'checkbox_label';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.checked = Boolean(settings[key]);
            input.addEventListener('change', () => {
                settings[key] = input.checked;
                this.saveSettings();
                this.updateCurrentVideoProperties(settings);
            });
            const span = document.createElement('span');
            span.textContent = text;
            label.append(input, span);
            panel.appendChild(label);
        };
        addCheckbox('anim-bg-enabled', 'Enable enhanced backgrounds', 'enabled');
        addCheckbox('anim-bg-loop', 'Loop videos', 'enableLoop');
        addCheckbox('anim-bg-autoplay', 'Autoplay videos', 'enableAutoplay');
        addCheckbox('anim-bg-mute', 'Mute videos by default', 'enableMute');
        addCheckbox('anim-bg-preload', 'Preload videos', 'enablePreload');

        const volumeLabel = document.createElement('label');
        volumeLabel.htmlFor = 'anim-bg-volume';
        volumeLabel.textContent = 'Video volume';
        const volume = document.createElement('input');
        volume.id = 'anim-bg-volume';
        volume.type = 'range';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.05';
        volume.value = String(settings.videoVolume);
        volume.addEventListener('input', () => {
            settings.videoVolume = Number(volume.value);
            this.saveSettings();
            this.updateCurrentVideoProperties(settings);
        });
        const hint = document.createElement('small');
        hint.textContent = 'SillyTavern handles file uploads. Use the URL field for direct YouTube playback.';
        panel.append(volumeLabel, volume, hint);
        return panel;
    }

    bindSettingsUI() {}

    addSettingsToUI() {
        if (document.getElementById('animated-backgrounds-settings')) return;
        const backgrounds = document.getElementById('Backgrounds');
        if (!backgrounds) {
            this.schedule(() => this.addSettingsToUI(), 500);
            return;
        }
        backgrounds.insertBefore(this.createSettingsUI(), document.getElementById('bg_tabs'));
    }

    destroy() {
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
        this.domHandlers.splice(0).forEach(remove => remove());
        this.eventHandlers.splice(0).forEach(remove => remove());
        this.nativeBackgroundObserver?.disconnect();
        this.nativeBackgroundObserver = null;
        this.clearAnimatedBackground();
        this.backgroundContainer?.remove();
        this.backgroundContainer = null;
        document.getElementById('animated-backgrounds-settings')?.remove();
        document.querySelectorAll(OWNED_FAVORITE_SELECTOR).forEach(item => item.remove());
        document.getElementById('animated-backgrounds-css')?.remove();
        this.isInitialized = false;
    }
}

export const animatedBackgrounds = new AnimatedBackgroundsModule();
