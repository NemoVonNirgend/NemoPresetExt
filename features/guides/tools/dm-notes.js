/**
 * DM Notes Tool
 * A persistent narrative scratchpad the AI uses to plan and track the story.
 * Stored as a lorebook entry, always in context.
 *
 * The AI can:
 *   - Read current notes to inform its response
 *   - Update notes after significant events
 *   - Add entries to specific sections
 *   - Clear outdated information
 *
 * Sections:
 *   - Plot Threads: active storylines, direction, priority
 *   - Off-Screen: what NPCs/world are doing when not in focus
 *   - Character Arcs: development trajectories, internal shifts
 *   - Foreshadowing: seeds planted that haven't paid off
 *   - Session Notes: key decisions, pending consequences, active promises/threats
 *   - Narrative Direction: where the story should head next, pacing notes
 */

import { getToolSettings } from '../tool-registry.js';
import { updateTracker, getTrackerContent } from '../lorebook-manager.js';

export const TOOL_NAME = 'NG_dm_notes';

const SECTIONS = ['plot_threads', 'off_screen', 'character_arcs', 'foreshadowing', 'session_notes', 'narrative_direction'];

const SECTION_LABELS = {
    plot_threads: 'Plot Threads',
    off_screen: 'Off-Screen Events',
    character_arcs: 'Character Arcs',
    foreshadowing: 'Foreshadowing Seeds',
    session_notes: 'Session Notes',
    narrative_direction: 'Narrative Direction',
};

const SECTION_MARKERS = {
    plot_threads: '♢ Plot Threads',
    off_screen: '♢ Off-Screen Events',
    character_arcs: '♢ Character Arcs',
    foreshadowing: '♢ Foreshadowing Seeds',
    session_notes: '♢ Session Notes',
    narrative_direction: '♢ Narrative Direction',
};

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
    return {
        name: TOOL_NAME,
        displayName: 'DM Notes',
        description: `A persistent narrative scratchpad for planning and tracking the story — like a game master's private notebook. Use this to maintain story coherence across turns.

Actions:
- "read": View current DM notes (all sections or a specific one). Use this before writing to check what plot threads are active, what's happening off-screen, and where the story is heading.
- "update": Replace a section's content entirely. Use when the situation has fundamentally changed.
- "append": Add a new entry to a section without removing existing notes. Use after significant events — a decision made, a secret revealed, a new thread introduced.
- "remove": Remove a specific item from a section. Use when a plot thread resolves, a foreshadowing seed pays off, or information becomes outdated.

Sections: plot_threads, off_screen, character_arcs, foreshadowing, session_notes, narrative_direction

Best practices:
- Read notes at the start of complex scenes to maintain consistency
- Append to session_notes after key character decisions or revelations
- Update off_screen when NPCs would logically be acting on their own agendas
- Move foreshadowing seeds to session_notes when they pay off
- Keep narrative_direction updated with pacing intentions`,
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['read', 'update', 'append', 'remove'],
                    description: 'What to do: read, update, append, or remove',
                },
                section: {
                    type: 'string',
                    enum: [...SECTIONS, 'all'],
                    description: 'Which section to act on, or "all" for read action',
                },
                content: {
                    type: 'string',
                    description: 'For update/append: the content to write. For remove: the item to remove (matched by substring).',
                },
            },
            required: ['action'],
        },
        action: execute,
        formatMessage: (params) => {
            const labels = { read: 'Reading', update: 'Updating', append: 'Adding to', remove: 'Removing from' };
            const sectionLabel = params?.section ? SECTION_LABELS[params.section] || params.section : 'all';
            return `${labels[params?.action] || 'Accessing'} DM notes (${sectionLabel})...`;
        },
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
        stealth: settings.stealth,
    };
}

async function execute({ action = 'read', section = 'all', content } = {}) {
    switch (action) {
        case 'read': return await readNotes(section);
        case 'update': return await updateSection(section, content);
        case 'append': return await appendToSection(section, content);
        case 'remove': return await removeFromSection(section, content);
        default: return `Error: Unknown action "${action}". Use read, update, append, or remove.`;
    }
}

// ── Notes Management ──

/**
 * Parse the stored notes into sections.
 * @returns {Promise<Object<string, string>>}
 */
async function parseNotes() {
    const raw = await getTrackerContent('dm_notes');
    if (!raw || raw.trim().length < 10) {
        return createEmptyNotes();
    }

    const sections = {};
    let currentSection = null;
    const lines = raw.split('\n');

    for (const line of lines) {
        // Check if this line is a section marker
        let foundSection = false;
        for (const [key, marker] of Object.entries(SECTION_MARKERS)) {
            if (line.trim().startsWith(marker)) {
                currentSection = key;
                sections[key] = '';
                foundSection = true;
                break;
            }
        }
        if (!foundSection && currentSection) {
            sections[currentSection] = (sections[currentSection] + '\n' + line).trim();
        }
    }

    // Ensure all sections exist
    for (const key of SECTIONS) {
        if (!sections[key]) sections[key] = '(empty)';
    }

    return sections;
}

function createEmptyNotes() {
    const sections = {};
    for (const key of SECTIONS) {
        sections[key] = '(empty)';
    }
    return sections;
}

function serializeNotes(sections) {
    const parts = [];
    for (const key of SECTIONS) {
        parts.push(`${SECTION_MARKERS[key]}\n${sections[key] || '(empty)'}`);
    }
    return parts.join('\n\n');
}

async function saveNotes(sections) {
    const serialized = serializeNotes(sections);
    await updateTracker('dm_notes', serialized);
}

// ── Actions ──

async function readNotes(section) {
    const sections = await parseNotes();

    if (section === 'all' || !section) {
        return serializeNotes(sections);
    }

    if (!SECTIONS.includes(section)) {
        return `Error: Unknown section "${section}". Valid sections: ${SECTIONS.join(', ')}`;
    }

    return `${SECTION_MARKERS[section]}\n${sections[section]}`;
}

async function updateSection(section, content) {
    if (!section || section === 'all') {
        return 'Error: Specify a section to update. Cannot update "all" at once.';
    }
    if (!SECTIONS.includes(section)) {
        return `Error: Unknown section "${section}". Valid sections: ${SECTIONS.join(', ')}`;
    }
    if (!content) {
        return 'Error: No content provided for update.';
    }

    const sections = await parseNotes();
    sections[section] = content;
    await saveNotes(sections);

    return `Updated ${SECTION_LABELS[section]}:\n${content}`;
}

async function appendToSection(section, content) {
    if (!section || section === 'all') {
        return 'Error: Specify a section to append to.';
    }
    if (!SECTIONS.includes(section)) {
        return `Error: Unknown section "${section}". Valid sections: ${SECTIONS.join(', ')}`;
    }
    if (!content) {
        return 'Error: No content provided to append.';
    }

    const sections = await parseNotes();
    const current = sections[section];

    if (current === '(empty)') {
        sections[section] = content;
    } else {
        sections[section] = current + '\n' + content;
    }

    await saveNotes(sections);
    return `Appended to ${SECTION_LABELS[section]}:\n${content}`;
}

async function removeFromSection(section, content) {
    if (!section || section === 'all') {
        return 'Error: Specify a section to remove from.';
    }
    if (!SECTIONS.includes(section)) {
        return `Error: Unknown section "${section}". Valid sections: ${SECTIONS.join(', ')}`;
    }
    if (!content) {
        return 'Error: No content specified to remove (matched by substring).';
    }

    const sections = await parseNotes();
    const lines = sections[section].split('\n');
    const filtered = lines.filter(line => !line.toLowerCase().includes(content.toLowerCase()));

    if (filtered.length === lines.length) {
        return `No matching entry found in ${SECTION_LABELS[section]} for "${content}".`;
    }

    sections[section] = filtered.join('\n').trim() || '(empty)';
    await saveNotes(sections);

    return `Removed entry matching "${content}" from ${SECTION_LABELS[section]}.`;
}

/**
 * Initialize empty DM notes for a fresh chat.
 * Called from index.js on new chat detection.
 */
export async function initDMNotes() {
    const settings = getToolSettings(TOOL_NAME);
    if (!settings.enabled) return;

    const existing = await getTrackerContent('dm_notes');
    if (existing && existing.trim().length > 20) return; // Already initialized

    const empty = createEmptyNotes();
    await saveNotes(empty);
    console.log('[NemosGuides] Initialized empty DM notes for new chat.');
}
