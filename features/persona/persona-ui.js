import { LOG_PREFIX } from '../../core/utils.js';

/**
 * NemoPersonaUI — Enhanced Persona Management panel with improved UX.
 * Injects CSS-only and lightweight JS enhancements into ST's existing persona drawer.
 */
export const NemoPersonaUI = {
    _initialized: false,

    initialize: function () {
        if (this._initialized) return;
        this._initialized = true;

        console.log(`${LOG_PREFIX} Initializing Persona UI enhancements...`);
        this._waitForPanel();
    },

    _waitForPanel: function () {
        const panel = document.getElementById('PersonaManagement');
        if (panel) {
            this._enhance(panel);
        } else {
            setTimeout(() => this._waitForPanel(), 500);
        }
    },

    _enhance: function (panel) {
        this._enhanceActionIcons(panel);
        this._enhanceConnectionButtons(panel);
        this._makeGlobalSettingsCollapsible(panel);
        this._addPersonaCount(panel);
        this._enhanceTempBanner(panel);

        console.log(`${LOG_PREFIX} Persona UI enhancements applied`);
    },

    /**
     * Group action icons semantically: [rename, sync] | [lore, image, duplicate] | [delete]
     */
    _enhanceActionIcons: function (panel) {
        const buttonsBlock = panel.querySelector('.persona_controls_buttons_block');
        if (!buttonsBlock) return;

        buttonsBlock.classList.add('nemo-persona-actions');

        const buttons = Array.from(buttonsBlock.querySelectorAll(':scope > .menu_button'));
        if (buttons.length < 6) return;

        // Group 1: Edit (rename, sync)
        const editGroup = document.createElement('div');
        editGroup.className = 'nemo-persona-action-group';
        editGroup.appendChild(buttons[0]); // rename
        editGroup.appendChild(buttons[1]); // sync

        // Group 2: Manage (lore, image, duplicate)
        const manageGroup = document.createElement('div');
        manageGroup.className = 'nemo-persona-action-group';
        manageGroup.appendChild(buttons[2]); // lore
        manageGroup.appendChild(buttons[3]); // image
        manageGroup.appendChild(buttons[4]); // duplicate

        // Group 3: Danger (delete)
        const dangerGroup = document.createElement('div');
        dangerGroup.className = 'nemo-persona-action-group nemo-persona-action-danger';
        dangerGroup.appendChild(buttons[5]); // delete

        buttonsBlock.appendChild(editGroup);
        buttonsBlock.appendChild(manageGroup);
        buttonsBlock.appendChild(dangerGroup);
    },

    /**
     * Watch connection button lock/unlock states and add visual classes
     */
    _enhanceConnectionButtons: function (panel) {
        const connectionsDiv = panel.querySelector('#persona_connections_buttons');
        if (!connectionsDiv) return;

        connectionsDiv.classList.add('nemo-persona-connections');

        const updateLockStates = () => {
            connectionsDiv.querySelectorAll('.menu_button').forEach(btn => {
                const icon = btn.querySelector('.icon');
                if (!icon) return;

                btn.classList.remove('nemo-persona-locked', 'nemo-persona-unlocked');
                if (icon.classList.contains('fa-lock')) {
                    btn.classList.add('nemo-persona-locked');
                } else {
                    btn.classList.add('nemo-persona-unlocked');
                }
            });
        };

        updateLockStates();

        // Re-check when icons change (lock/unlock toggling)
        const observer = new MutationObserver(updateLockStates);
        connectionsDiv.querySelectorAll('.icon').forEach(icon => {
            observer.observe(icon, { attributes: true, attributeFilter: ['class'] });
        });

        // Also re-check when buttons are clicked
        connectionsDiv.addEventListener('click', () => {
            setTimeout(updateLockStates, 100);
        });
    },

    /**
     * Collapse Global Settings by default with toggle
     */
    _makeGlobalSettingsCollapsible: function (panel) {
        const globalSettings = panel.querySelector('.persona_management_global_settings');
        if (!globalSettings) return;

        const header = globalSettings.querySelector('h4');
        if (!header) return;

        header.classList.add('nemo-persona-collapsible-header');

        // Add chevron
        const chevron = document.createElement('i');
        chevron.className = 'fa-solid fa-chevron-right nemo-persona-chevron';
        header.appendChild(chevron);

        // Wrap content
        const content = document.createElement('div');
        content.className = 'nemo-persona-settings-content nemo-persona-collapsed';

        const children = Array.from(globalSettings.children).filter(c => c !== header);
        children.forEach(child => content.appendChild(child));
        globalSettings.appendChild(content);

        header.addEventListener('click', () => {
            const isCollapsed = content.classList.toggle('nemo-persona-collapsed');
            chevron.classList.toggle('fa-chevron-down', !isCollapsed);
            chevron.classList.toggle('fa-chevron-right', isCollapsed);
        });
    },

    /**
     * Add persona count badge next to Create button
     */
    _addPersonaCount: function (panel) {
        const avatarBlock = panel.querySelector('#user_avatar_block');
        if (!avatarBlock) return;

        const toolbar = panel.querySelector('.persona_management_left_column .flex-container.marginBot10');
        if (!toolbar) return;

        const badge = document.createElement('span');
        badge.className = 'nemo-persona-count-badge';
        badge.title = 'Total personas';

        const updateCount = () => {
            const count = avatarBlock.querySelectorAll('.avatar-container').length;
            badge.innerHTML = `<i class="fa-solid fa-users"></i> ${count}`;
        };

        const createBtn = toolbar.querySelector('#create_dummy_persona');
        if (createBtn) {
            createBtn.after(badge);
        }

        setTimeout(updateCount, 100);

        // Update when personas are added/removed
        const observer = new MutationObserver(() => setTimeout(updateCount, 50));
        observer.observe(avatarBlock, { childList: true });
    },

    /**
     * Style the "Temporary persona in use" banner
     */
    _enhanceTempBanner: function (panel) {
        const infoBlock = panel.querySelector('#persona_connections_info_block');
        if (!infoBlock) return;

        const styleBanner = () => {
            const infoDiv = infoBlock.querySelector('div');
            if (infoDiv && !infoDiv.classList.contains('nemo-persona-temp-banner')) {
                infoDiv.classList.add('nemo-persona-temp-banner');
            }
        };

        styleBanner();
        const observer = new MutationObserver(styleBanner);
        observer.observe(infoBlock, { childList: true, subtree: true });
    },
};
