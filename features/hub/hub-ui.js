import { NEMO_EXTENSION_CATALOG } from './catalog.js';
import { installHubExtension, isHubExtensionInstalled } from './installer.js';
import logger from '../../core/logger.js';

function element(tag, className, text) {
    const value = document.createElement(tag);
    if (className) value.className = className;
    if (text != null) value.textContent = text;
    return value;
}

function renderCard(entry) {
    const card = element('article', 'nemo-hub-card');
    card.dataset.extensionId = entry.id;
    const heading = element('div', 'nemo-hub-card-heading');
    const icon = element('i', entry.icon);
    const title = element('div');
    title.append(element('h4', '', entry.name), element('small', '', entry.category));
    heading.append(icon, title);
    const description = element('p', '', entry.description);
    const status = element('span', 'nemo-hub-status');
    const action = element('button', 'menu_button nemo-hub-action');
    action.type = 'button';

    function refresh() {
        const installed = isHubExtensionInstalled(entry.id);
        status.textContent = installed ? 'Installed' : 'Optional';
        status.dataset.state = installed ? 'installed' : 'available';
        action.textContent = installed ? 'Installed' : 'Install';
        action.disabled = installed;
    }

    action.addEventListener('click', async () => {
        if (action.dataset.action === 'reload') {
            window.location.reload();
            return;
        }
        if (!window.confirm(`Install ${entry.name} from ${entry.repository}?`)) return;
        action.disabled = true;
        action.textContent = 'Installing…';
        status.textContent = 'Installing';
        try {
            const result = await installHubExtension(entry);
            refresh();
            if (!result.installed) {
                status.textContent = 'Installed · reload required';
                action.textContent = 'Reload SillyTavern';
                action.disabled = false;
                action.dataset.action = 'reload';
            }
        } catch (error) {
            logger.error(`Failed to install ${entry.name} from Nemo Hub.`, error);
            status.textContent = `Installation failed: ${error.message}`;
            action.textContent = 'Retry';
            action.disabled = false;
        }
    });

    card.append(heading, description, status, action);
    refresh();
    return card;
}

export const NemoExtensionHub = Object.freeze({
    mount(root = document.getElementById('nemoExtensionHubCatalog')) {
        if (!root) return false;
        root.replaceChildren(...NEMO_EXTENSION_CATALOG.map(renderCard));
        return true;
    },
});
