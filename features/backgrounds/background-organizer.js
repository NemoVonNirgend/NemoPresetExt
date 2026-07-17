/**
 * Animated-background settings drawer.
 *
 * Current SillyTavern staging provides native folder creation, assignment,
 * filtering, and sorting. Nemo no longer builds a competing virtual folder
 * hierarchy or stores unsupported values in SillyTavern's sort control.
 */

import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import logger from '../../core/logger.js';
import { LOG_PREFIX } from '../../core/utils.js';

class BackgroundOrganizer {
    constructor() {
        this.isInitialized = false;
        this.settingsDrawerOpen = false;
        this.observer = null;
        this.drawer = null;
    }

    ensureSettings() {
        extension_settings.NemoPresetExt ??= {};
        const saved = extension_settings.NemoPresetExt.backgroundOrganizer;
        this.settingsDrawerOpen = Boolean(saved?.settingsDrawerOpen);
        extension_settings.NemoPresetExt.backgroundOrganizer = {
            settingsDrawerOpen: this.settingsDrawerOpen,
        };
    }

    saveSettings() {
        extension_settings.NemoPresetExt.backgroundOrganizer = {
            settingsDrawerOpen: this.settingsDrawerOpen,
        };
        saveSettingsDebounced();
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        try {
            this.ensureSettings();
            this.loadCSS();
            if (!this.wrapAnimatedSettings()) this.observeForSettings();
            logger.info(`${LOG_PREFIX} Background settings drawer initialized; using SillyTavern native folders`);
        } catch (error) {
            this.destroy();
            logger.error(`${LOG_PREFIX} Background settings drawer initialization failed`, error);
        }
    }

    loadCSS() {
        if (document.getElementById('background-organizer-css')) return;
        const link = document.createElement('link');
        link.id = 'background-organizer-css';
        link.rel = 'stylesheet';
        link.href = new URL('background-organizer.css', import.meta.url).href;
        document.head.appendChild(link);
    }

    observeForSettings() {
        const backgrounds = document.getElementById('Backgrounds');
        if (!backgrounds) return;
        this.observer?.disconnect();
        this.observer = new MutationObserver(() => {
            if (this.wrapAnimatedSettings()) {
                this.observer?.disconnect();
                this.observer = null;
            }
        });
        this.observer.observe(backgrounds, { childList: true, subtree: true });
    }

    wrapAnimatedSettings() {
        const settings = document.getElementById('animated-backgrounds-settings');
        if (!settings) return false;
        if (settings.closest('.bg-settings-drawer')) {
            this.drawer = settings.closest('.bg-settings-drawer');
            return true;
        }

        const drawer = document.createElement('section');
        drawer.className = `bg-settings-drawer${this.settingsDrawerOpen ? ' open' : ''}`;
        drawer.dataset.nemoBackgroundOrganizer = 'true';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'bg-settings-drawer-header';
        header.setAttribute('aria-expanded', String(this.settingsDrawerOpen));
        const chevron = document.createElement('i');
        chevron.className = 'fa-solid fa-chevron-down bg-settings-drawer-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        const film = document.createElement('i');
        film.className = 'fa-solid fa-film';
        film.setAttribute('aria-hidden', 'true');
        const title = document.createElement('span');
        title.className = 'bg-settings-drawer-title';
        title.textContent = 'Animated background settings';
        header.append(chevron, film, title);

        const content = document.createElement('div');
        content.className = 'bg-settings-drawer-content';
        settings.parentNode.insertBefore(drawer, settings);
        content.appendChild(settings);
        drawer.append(header, content);

        header.addEventListener('click', () => {
            this.settingsDrawerOpen = !this.settingsDrawerOpen;
            drawer.classList.toggle('open', this.settingsDrawerOpen);
            header.setAttribute('aria-expanded', String(this.settingsDrawerOpen));
            this.saveSettings();
        });
        this.drawer = drawer;
        return true;
    }

    destroy() {
        this.observer?.disconnect();
        this.observer = null;
        const drawer = this.drawer ?? document.querySelector('[data-nemo-background-organizer="true"]');
        const settings = drawer?.querySelector('#animated-backgrounds-settings');
        if (drawer?.parentNode && settings) drawer.parentNode.insertBefore(settings, drawer);
        drawer?.remove();
        this.drawer = null;
        document.getElementById('background-organizer-css')?.remove();
        this.isInitialized = false;
    }
}

export const backgroundOrganizer = new BackgroundOrganizer();
