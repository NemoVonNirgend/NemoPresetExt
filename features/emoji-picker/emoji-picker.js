import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { CATEGORIES, SKIN_TONES, EMOJIS } from './emoji-data.js';

const PREFIX = '[EmojiPicker]';
const BATCH_SIZE = 80;
const SEARCH_DEBOUNCE = 200;
const MAX_RECENTS = 32;

/** @returns {object} settings ref */
function getSettings() {
    if (!extension_settings.NemoPresetExt) extension_settings.NemoPresetExt = {};
    if (!extension_settings.NemoPresetExt.emojiPicker) {
        extension_settings.NemoPresetExt.emojiPicker = {
            favorites: [],
            recents: [],
            skinTone: 0,
            lastCategory: 'smileys',
        };
    }
    return extension_settings.NemoPresetExt.emojiPicker;
}

// ── State ──────────────────────────────────────────────
let pickerEl = null;
let isOpen = false;
let activeCategory = 'smileys';
let renderedCount = 0;
let currentEmojis = [];
let searchTimeout = null;
let observer = null; // IntersectionObserver for lazy loading

// ── DOM builders ───────────────────────────────────────
function buildPicker() {
    const picker = document.createElement('div');
    picker.id = 'nemo-emoji-picker';
    picker.className = 'nemo-emoji-picker';
    picker.innerHTML = `
        <div class="nemo-ep-header">
            <div class="nemo-ep-search-wrap">
                <i class="fa-solid fa-magnifying-glass nemo-ep-search-icon"></i>
                <input type="text" class="nemo-ep-search" placeholder="Search emoji..." autocomplete="off" />
            </div>
            <div class="nemo-ep-skin-tones">
                ${SKIN_TONES.map(t => `<button class="nemo-ep-tone${t.id === getSettings().skinTone ? ' active' : ''}" data-tone="${t.id}" title="${t.label}">${t.id === 0 ? '✋' : '✋' + t.mod}</button>`).join('')}
            </div>
        </div>
        <div class="nemo-ep-tabs">
            <button class="nemo-ep-tab" data-cat="favorites" title="Favorites">⭐</button>
            <button class="nemo-ep-tab" data-cat="recents" title="Recently Used">🕐</button>
            ${CATEGORIES.map(c => `<button class="nemo-ep-tab" data-cat="${c.id}" title="${c.name}">${c.icon}</button>`).join('')}
        </div>
        <div class="nemo-ep-grid-wrap">
            <div class="nemo-ep-grid"></div>
            <div class="nemo-ep-sentinel"></div>
        </div>
        <div class="nemo-ep-preview">
            <span class="nemo-ep-preview-emoji"></span>
            <span class="nemo-ep-preview-name"></span>
        </div>
    `;
    return picker;
}

function buildTriggerButton() {
    const btn = document.createElement('div');
    btn.id = 'nemo-emoji-trigger';
    btn.className = 'nemo-emoji-trigger interactable';
    btn.title = 'Emoji Picker';
    btn.innerHTML = '<i class="fa-regular fa-face-smile"></i>';
    return btn;
}

// ── Emoji helpers ──────────────────────────────────────
function applySkinTone(emoji, skinSupported) {
    if (!skinSupported) return emoji;
    const tone = getSettings().skinTone;
    if (tone === 0) return emoji;
    const mod = SKIN_TONES[tone]?.mod;
    if (!mod) return emoji;
    // Insert modifier after first code point
    const codePoints = [...emoji];
    if (codePoints.length >= 1) {
        return codePoints[0] + mod + codePoints.slice(1).join('');
    }
    return emoji + mod;
}

function getEmojisForCategory(catId) {
    const settings = getSettings();
    if (catId === 'favorites') {
        return settings.favorites.map(e => EMOJIS.find(em => em.e === e)).filter(Boolean);
    }
    if (catId === 'recents') {
        return settings.recents.map(e => EMOJIS.find(em => em.e === e)).filter(Boolean);
    }
    return EMOJIS.filter(em => em.c === catId);
}

function searchEmojis(query) {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return EMOJIS.filter(em =>
        em.n.includes(q) || em.k.some(k => k.includes(q))
    );
}

// ── Rendering ──────────────────────────────────────────
function renderBatch() {
    if (!pickerEl) return;
    const grid = pickerEl.querySelector('.nemo-ep-grid');
    const end = Math.min(renderedCount + BATCH_SIZE, currentEmojis.length);
    const fragment = document.createDocumentFragment();

    for (let i = renderedCount; i < end; i++) {
        const em = currentEmojis[i];
        const btn = document.createElement('button');
        btn.className = 'nemo-emoji-btn';
        btn.textContent = applySkinTone(em.e, em.s);
        btn.dataset.emoji = em.e;
        btn.dataset.name = em.n;
        btn.dataset.skin = em.s ? '1' : '0';
        btn.title = em.n;
        fragment.appendChild(btn);
    }

    grid.appendChild(fragment);
    renderedCount = end;

    // Hide sentinel if all loaded
    const sentinel = pickerEl.querySelector('.nemo-ep-sentinel');
    if (renderedCount >= currentEmojis.length) {
        sentinel.style.display = 'none';
    } else {
        sentinel.style.display = 'block';
    }
}

function renderCategory(catId) {
    if (!pickerEl) return;
    activeCategory = catId;
    renderedCount = 0;
    currentEmojis = getEmojisForCategory(catId);

    const grid = pickerEl.querySelector('.nemo-ep-grid');
    grid.innerHTML = '';
    grid.scrollTop = 0;
    const gridWrap = pickerEl.querySelector('.nemo-ep-grid-wrap');
    gridWrap.scrollTop = 0;

    // Update active tab
    pickerEl.querySelectorAll('.nemo-ep-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === catId);
    });

    // Show empty state for favorites/recents
    if (currentEmojis.length === 0) {
        grid.innerHTML = `<div class="nemo-ep-empty">${catId === 'favorites' ? 'No favorites yet. Right-click an emoji to favorite it.' : 'No recent emojis yet.'}</div>`;
        return;
    }

    renderBatch();

    // Save last category
    if (catId !== 'favorites' && catId !== 'recents') {
        getSettings().lastCategory = catId;
        saveSettingsDebounced();
    }
}

function renderSearchResults(results) {
    if (!pickerEl) return;
    renderedCount = 0;
    currentEmojis = results;

    const grid = pickerEl.querySelector('.nemo-ep-grid');
    grid.innerHTML = '';
    const gridWrap = pickerEl.querySelector('.nemo-ep-grid-wrap');
    gridWrap.scrollTop = 0;

    // Clear active tab highlight
    pickerEl.querySelectorAll('.nemo-ep-tab').forEach(tab => tab.classList.remove('active'));

    if (results.length === 0) {
        grid.innerHTML = '<div class="nemo-ep-empty">No emojis found.</div>';
        return;
    }

    renderBatch();
}

function refreshVisibleSkinTones() {
    if (!pickerEl) return;
    pickerEl.querySelectorAll('.nemo-emoji-btn').forEach(btn => {
        const baseEmoji = btn.dataset.emoji;
        const skinSupported = btn.dataset.skin === '1';
        btn.textContent = applySkinTone(baseEmoji, skinSupported);
    });
    // Update tone button active state
    pickerEl.querySelectorAll('.nemo-ep-tone').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.tone) === getSettings().skinTone);
    });
}

// ── Insertion ──────────────────────────────────────────
function insertEmoji(emoji) {
    const textarea = document.getElementById('send_textarea');
    if (!textarea) return;

    const text = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = text.substring(0, start) + emoji + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();

    // Track in recents
    const settings = getSettings();
    // Find the base emoji (without skin tone) for storage
    const baseEntry = EMOJIS.find(em => em.e === emoji) ||
                      EMOJIS.find(em => applySkinTone(em.e, em.s) === emoji);
    const baseChar = baseEntry ? baseEntry.e : emoji;

    settings.recents = [baseChar, ...settings.recents.filter(e => e !== baseChar)].slice(0, MAX_RECENTS);
    saveSettingsDebounced();
}

function toggleFavorite(emojiChar) {
    const settings = getSettings();
    const idx = settings.favorites.indexOf(emojiChar);
    if (idx >= 0) {
        settings.favorites.splice(idx, 1);
    } else {
        settings.favorites.push(emojiChar);
    }
    saveSettingsDebounced();
}

// ── Open / Close ───────────────────────────────────────
function openPicker() {
    if (!pickerEl) return;
    pickerEl.classList.add('open');
    isOpen = true;

    // Position picker
    positionPicker();

    // Load last category or default
    const settings = getSettings();
    renderCategory(settings.lastCategory || 'smileys');

    // Focus search
    setTimeout(() => {
        const search = pickerEl.querySelector('.nemo-ep-search');
        if (search) search.focus();
    }, 50);
}

function closePicker() {
    if (!pickerEl) return;
    pickerEl.classList.remove('open');
    isOpen = false;

    // Clear search
    const search = pickerEl.querySelector('.nemo-ep-search');
    if (search) search.value = '';
}

function positionPicker() {
    if (!pickerEl) return;
    const trigger = document.getElementById('nemo-emoji-trigger');
    if (!trigger) return;

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // Full width bottom tray on mobile
        pickerEl.classList.add('mobile');
        return;
    }

    pickerEl.classList.remove('mobile');
    const rect = trigger.getBoundingClientRect();
    const pickerHeight = 420;
    const pickerWidth = 340;

    // Position above trigger (chat input is at the bottom)
    pickerEl.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    pickerEl.style.top = 'auto';

    // Align right edge with trigger's right edge (Discord-style)
    let right = window.innerWidth - rect.right;
    if (right < 8) right = 8;
    pickerEl.style.right = right + 'px';
    pickerEl.style.left = 'auto';
}

// ── Events ─────────────────────────────────────────────
function setupEvents() {
    if (!pickerEl) return;
    const trigger = document.getElementById('nemo-emoji-trigger');

    // Trigger toggle
    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) closePicker(); else openPicker();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (isOpen && !pickerEl.contains(e.target) && e.target !== trigger) {
            closePicker();
        }
    });

    // Stop picker clicks from propagating
    pickerEl.addEventListener('click', (e) => e.stopPropagation());

    // Tab clicks
    pickerEl.querySelector('.nemo-ep-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.nemo-ep-tab');
        if (!tab) return;
        const cat = tab.dataset.cat;
        // Clear search when switching tabs
        const search = pickerEl.querySelector('.nemo-ep-search');
        if (search) search.value = '';
        renderCategory(cat);
    });

    // Emoji clicks
    pickerEl.querySelector('.nemo-ep-grid').addEventListener('click', (e) => {
        const btn = e.target.closest('.nemo-emoji-btn');
        if (!btn) return;
        const emoji = btn.textContent; // Use displayed emoji (with skin tone)
        insertEmoji(emoji);
    });

    // Right-click / long-press to favorite
    pickerEl.querySelector('.nemo-ep-grid').addEventListener('contextmenu', (e) => {
        const btn = e.target.closest('.nemo-emoji-btn');
        if (!btn) return;
        e.preventDefault();
        const baseEmoji = btn.dataset.emoji;
        toggleFavorite(baseEmoji);

        // Visual feedback
        btn.classList.add('nemo-ep-faved');
        setTimeout(() => btn.classList.remove('nemo-ep-faved'), 400);
    });

    // Hover preview
    pickerEl.querySelector('.nemo-ep-grid').addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.nemo-emoji-btn');
        if (!btn) return;
        const previewEmoji = pickerEl.querySelector('.nemo-ep-preview-emoji');
        const previewName = pickerEl.querySelector('.nemo-ep-preview-name');
        if (previewEmoji) previewEmoji.textContent = btn.textContent;
        if (previewName) previewName.textContent = btn.dataset.name;
    });

    // Search
    const searchInput = pickerEl.querySelector('.nemo-ep-search');
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value;
            if (query.trim()) {
                const results = searchEmojis(query);
                if (results) renderSearchResults(results);
            } else {
                renderCategory(activeCategory);
            }
        }, SEARCH_DEBOUNCE);
    });

    // Skin tone clicks
    pickerEl.querySelector('.nemo-ep-skin-tones').addEventListener('click', (e) => {
        const btn = e.target.closest('.nemo-ep-tone');
        if (!btn) return;
        const tone = parseInt(btn.dataset.tone);
        getSettings().skinTone = tone;
        saveSettingsDebounced();
        refreshVisibleSkinTones();
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closePicker();
        }
    });

    // IntersectionObserver for lazy loading
    const sentinel = pickerEl.querySelector('.nemo-ep-sentinel');
    if (sentinel) {
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && renderedCount < currentEmojis.length) {
                renderBatch();
            }
        }, {
            root: pickerEl.querySelector('.nemo-ep-grid-wrap'),
            threshold: 0.1,
        });
        observer.observe(sentinel);
    }

    // Window resize - reposition
    window.addEventListener('resize', () => {
        if (isOpen) positionPicker();
    });
}

// ── Initialize ─────────────────────────────────────────
export const EmojiPicker = {
    isInitialized: false,

    initialize() {
        if (this.isInitialized) return;

        // Ensure settings exist
        getSettings();

        // Build picker DOM
        pickerEl = buildPicker();
        document.body.appendChild(pickerEl);

        // Inject trigger button
        this.injectTrigger();

        // Wire events
        setupEvents();

        this.isInitialized = true;
        console.log(`${PREFIX} Initialized`);
    },

    injectTrigger() {
        // Place on the right side of the input bar (like Discord)
        const rightForm = document.querySelector('#rightSendForm');
        if (!rightForm) {
            console.warn(`${PREFIX} Could not find #rightSendForm for trigger button`);
            return;
        }

        const btn = buildTriggerButton();
        // Prepend so it appears first (leftmost) in the right-side controls
        rightForm.prepend(btn);
    },
};
