/**
 * NemoPresetExt - Proxy Manager
 *
 * Multi-proxy card UI for managing custom OpenAI-compatible endpoints.
 * Displays a horizontal scrollable row of proxy cards above the model grid
 * when the 'custom' source is active.
 */

import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import logger from '../../core/logger.js';

/** @type {HTMLElement|null} */
let containerEl = null;

/** @type {HTMLElement|null} */
let proxyRow = null;

/** @type {HTMLElement|null} */
let formContainer = null;

/** @type {string|null} ID of proxy being edited, null for new */
let editingId = null;

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
function generateId() {
    return 'proxy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Get the proxies array from extension settings.
 * @returns {Array<{id: string, name: string, url: string, password: string, active: boolean}>}
 */
function getAll() {
    if (!extension_settings.NemoPresetExt) {
        extension_settings.NemoPresetExt = {};
    }
    if (!Array.isArray(extension_settings.NemoPresetExt.customProxies)) {
        extension_settings.NemoPresetExt.customProxies = [];
    }
    return extension_settings.NemoPresetExt.customProxies;
}

/**
 * Save the proxies array to extension settings.
 * @param {Array} proxies
 */
function save(proxies) {
    if (!extension_settings.NemoPresetExt) {
        extension_settings.NemoPresetExt = {};
    }
    extension_settings.NemoPresetExt.customProxies = proxies;
    saveSettingsDebounced();
}

/**
 * Get a single proxy by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
function getProxy(id) {
    return getAll().find(p => p.id === id);
}

/**
 * Load the CSS stylesheet if not already loaded.
 */
function loadCSS() {
    if (!document.querySelector('link[href*="proxy-manager.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'scripts/extensions/third-party/NemoPresetExt/features/connection/proxy-manager.css';
        document.head.appendChild(link);
    }
}

/**
 * Create a proxy card element.
 * @param {object} proxy
 * @returns {HTMLElement}
 */
function createProxyCard(proxy) {
    const card = document.createElement('div');
    card.className = 'nemo-proxy-card' + (proxy.active ? ' active' : '');
    card.dataset.proxyId = proxy.id;

    // Active dot
    const dot = document.createElement('div');
    dot.className = 'nemo-proxy-active-dot';
    card.appendChild(dot);

    // Name
    const name = document.createElement('div');
    name.className = 'nemo-proxy-name';
    name.textContent = proxy.name || 'Unnamed';
    name.title = proxy.name || 'Unnamed';
    card.appendChild(name);

    // URL (truncated)
    const url = document.createElement('div');
    url.className = 'nemo-proxy-url';
    url.textContent = proxy.url || 'No URL';
    url.title = proxy.url || '';
    card.appendChild(url);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'nemo-proxy-actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
    editBtn.title = 'Edit proxy';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showForm(proxy.id);
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'nemo-proxy-delete';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.title = 'Delete proxy';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (deleteBtn.dataset.confirming) {
            deleteProxy(proxy.id);
            return;
        }
        deleteBtn.dataset.confirming = 'true';
        deleteBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm';
        deleteBtn.style.color = '#f44336';
        setTimeout(() => {
            if (deleteBtn.isConnected) {
                delete deleteBtn.dataset.confirming;
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.style.color = '';
            }
        }, 3000);
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);

    // Click card to activate
    card.addEventListener('click', () => {
        ProxyManager.activate(proxy.id);
    });

    return card;
}

/**
 * Create the "Add Proxy" card.
 * @returns {HTMLElement}
 */
function createAddCard() {
    const card = document.createElement('div');
    card.className = 'nemo-proxy-card-add';
    card.innerHTML = '<i class="fa-solid fa-plus"></i><span>Add Proxy</span>';
    card.addEventListener('click', () => {
        showForm(null);
    });
    return card;
}

/**
 * Show the add/edit form.
 * @param {string|null} proxyId - ID to edit, or null for new
 */
function showForm(proxyId) {
    editingId = proxyId;
    const proxy = proxyId ? getProxy(proxyId) : null;

    if (formContainer) {
        formContainer.remove();
    }

    formContainer = document.createElement('div');
    formContainer.className = 'nemo-proxy-form';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Proxy Name';
    nameInput.value = proxy ? proxy.name : '';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Base URL (e.g., http://localhost:5001/v1)';
    urlInput.value = proxy ? proxy.url : '';

    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.placeholder = 'API Key / Password (optional)';
    passInput.value = proxy ? proxy.password : '';

    const btnRow = document.createElement('div');
    btnRow.className = 'nemo-proxy-form-buttons';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'nemo-proxy-save-btn';
    saveBtn.textContent = proxy ? 'Update' : 'Save';
    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const password = passInput.value;

        if (!name || !url) {
            nameInput.style.borderColor = !name ? '#f44336' : '';
            urlInput.style.borderColor = !url ? '#f44336' : '';
            return;
        }

        if (editingId) {
            updateProxy(editingId, { name, url, password });
        } else {
            addProxy({ name, url, password });
        }

        hideForm();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'nemo-proxy-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        hideForm();
    });

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);

    formContainer.appendChild(nameInput);
    formContainer.appendChild(urlInput);
    formContainer.appendChild(passInput);
    formContainer.appendChild(btnRow);

    containerEl.appendChild(formContainer);
    nameInput.focus();
}

/**
 * Hide the add/edit form.
 */
function hideForm() {
    if (formContainer) {
        formContainer.remove();
        formContainer = null;
    }
    editingId = null;
}

/**
 * Add a new proxy.
 * @param {{name: string, url: string, password: string}} data
 */
function addProxy(data) {
    const proxies = getAll();
    const isFirst = proxies.length === 0;
    proxies.push({
        id: generateId(),
        name: data.name,
        url: data.url,
        password: data.password,
        active: isFirst,
    });
    save(proxies);

    if (isFirst) {
        applyProxyFields(proxies[proxies.length - 1]);
    }

    ProxyManager.refresh();
    logger.debug('ProxyManager: Added proxy', data.name);
}

/**
 * Update an existing proxy.
 * @param {string} id
 * @param {{name: string, url: string, password: string}} data
 */
function updateProxy(id, data) {
    const proxies = getAll();
    const proxy = proxies.find(p => p.id === id);
    if (!proxy) return;

    proxy.name = data.name;
    proxy.url = data.url;
    proxy.password = data.password;
    save(proxies);

    // If this proxy is active, re-apply its fields
    if (proxy.active) {
        applyProxyFields(proxy);
    }

    ProxyManager.refresh();
    logger.debug('ProxyManager: Updated proxy', data.name);
}

/**
 * Delete a proxy.
 * @param {string} id
 */
function deleteProxy(id) {
    let proxies = getAll();
    const wasActive = proxies.find(p => p.id === id)?.active;
    proxies = proxies.filter(p => p.id !== id);

    // If deleted proxy was active, activate the first remaining one
    if (wasActive && proxies.length > 0) {
        proxies[0].active = true;
        applyProxyFields(proxies[0]);
    }

    save(proxies);
    ProxyManager.refresh();
    logger.debug('ProxyManager: Deleted proxy', id);
}

/**
 * Apply a proxy's URL and password to SillyTavern's custom endpoint fields.
 * @param {object} proxy
 */
function applyProxyFields(proxy) {
    // Find the custom endpoint URL input — try multiple possible IDs
    const urlSelectors = ['#custom_api_url_text', '#openai_reverse_proxy', 'input[placeholder*="localhost"]'];
    for (const sel of urlSelectors) {
        const urlInput = document.querySelector(sel);
        if (urlInput && urlInput.closest('[data-source*="custom"]')) {
            urlInput.value = proxy.url;
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }
        // Fallback: just set it if we find it
        if (urlInput && sel === '#custom_api_url_text') {
            urlInput.value = proxy.url;
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }
    }

    // Also try setting via jQuery if oai_settings is accessible
    try {
        const customUrlField = document.querySelector('#openai_api input.text_pole[placeholder*="localhost"]');
        if (customUrlField) {
            customUrlField.value = proxy.url;
            customUrlField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (e) { /* ignore */ }

    // Set custom API key
    const keyInput = document.getElementById('api_key_custom');
    if (keyInput) {
        keyInput.value = proxy.password || '';
        keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Auto-click Connect after a short delay to fetch models
    setTimeout(() => {
        const connectBtn = document.getElementById('api_button_openai');
        if (connectBtn) {
            connectBtn.click();
            logger.debug('ProxyManager: Auto-triggered Connect');
        }
    }, 300);
}

/**
 * Render the proxy cards into the container.
 */
function renderCards() {
    if (!containerEl) return;

    // Clear everything except the form (if open)
    const existingBars = containerEl.querySelectorAll('.nemo-proxy-bar');
    existingBars.forEach(b => b.remove());

    // Build bar
    const bar = document.createElement('div');
    bar.className = 'nemo-proxy-bar';

    // Card row
    proxyRow = document.createElement('div');
    proxyRow.className = 'nemo-proxy-row';

    const proxies = getAll();
    for (const proxy of proxies) {
        proxyRow.appendChild(createProxyCard(proxy));
    }

    proxyRow.appendChild(createAddCard());
    bar.appendChild(proxyRow);

    // Insert bar at the beginning of the container (before the form if present)
    if (formContainer && formContainer.parentNode === containerEl) {
        containerEl.insertBefore(bar, formContainer);
    } else {
        containerEl.appendChild(bar);
    }
}

export const ProxyManager = {
    /**
     * Initialize the proxy manager UI into the given container.
     * @param {HTMLElement} el - Container element to render into
     */
    initialize(el) {
        containerEl = el;
        loadCSS();
        renderCards();
        logger.debug('ProxyManager: Initialized');
    },

    /**
     * Remove the proxy manager UI.
     */
    destroy() {
        hideForm();
        if (containerEl) {
            containerEl.innerHTML = '';
        }
        containerEl = null;
        proxyRow = null;
        logger.debug('ProxyManager: Destroyed');
    },

    /**
     * Re-render the proxy cards.
     */
    refresh() {
        if (!containerEl) return;
        // Preserve form if open
        const hadForm = formContainer && formContainer.parentNode === containerEl;
        renderCards();
        // Re-attach form if it was open
        if (hadForm && formContainer) {
            containerEl.appendChild(formContainer);
        }
    },

    /**
     * Get the currently active proxy configuration.
     * @returns {object|undefined}
     */
    getActive() {
        return getAll().find(p => p.active);
    },

    /**
     * Activate a proxy by ID — marks it active, updates ST fields.
     * @param {string} proxyId
     */
    activate(proxyId) {
        const proxies = getAll();
        const proxy = proxies.find(p => p.id === proxyId);
        if (!proxy) return;

        // Mark as active
        proxies.forEach(p => p.active = p.id === proxyId);
        save(proxies);

        // Apply to SillyTavern fields
        applyProxyFields(proxy);

        this.refresh();
        logger.debug('ProxyManager: Activated proxy', proxy.name);
    },
};
