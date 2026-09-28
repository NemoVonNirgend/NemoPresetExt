import { buildSectionIndex, readOrderedState } from './state-model.js';

export const TOP_LEVEL_SECTION_ID = '__nemo_top_level__';

const fail = message => new Error(`Nemo prompt consumers: ${message}`);

export function classifierFor(manager) {
    return name => {
        if (typeof manager?.getDividerInfo !== 'function') throw fail('divider classifier is unavailable.');
        const fake = { dataset: {}, querySelector() { return { textContent: name }; } };
        return manager.getDividerInfo(fake, true);
    };
}

export function readConsumerState(pm, manager) {
    const rows = readOrderedState(pm);
    const index = buildSectionIndex(rows, classifierFor(manager));
    const sources = new Map((pm?.serviceSettings?.prompts || []).map(prompt => [prompt.identifier, prompt]));
    return Object.freeze({ rows, index, sources });
}

export function sectionIdentifierFromElement(section) {
    if (section?.classList?.contains?.('nemo-top-level-section')) return TOP_LEVEL_SECTION_ID;
    return section?.querySelector?.('summary > li[data-pm-identifier]')?.dataset?.pmIdentifier
        || section?.querySelector?.('summary [data-pm-identifier]')?.dataset?.pmIdentifier
        || null;
}

function recordFor(state, identifier) {
    const row = state.index.getRow(identifier);
    if (!row) throw fail(`row metadata is unavailable: ${identifier}`);
    return Object.freeze({ identifier: row.identifier, name: row.name });
}

export function topLevelRecords(pm, manager) {
    const state = readConsumerState(pm, manager);
    const sections = new Set(state.index.sectionIds);
    return Object.freeze(state.rows
        .filter(row => !sections.has(row.identifier) && state.index.parentOf(row.identifier) === null)
        .map(row => Object.freeze({ identifier: row.identifier, name: row.name })));
}

export function sectionRecords(pm, manager, sectionId, { includeChildren = true } = {}) {
    if (sectionId === TOP_LEVEL_SECTION_ID) return topLevelRecords(pm, manager);
    const state = readConsumerState(pm, manager);
    const section = state.index.getSection(sectionId);
    if (!section) throw fail(`section metadata is unavailable: ${sectionId}`);
    const records = section.directIds.map(identifier => recordFor(state, identifier));
    if (includeChildren) {
        for (const childId of section.children) {
            const child = state.index.getSection(childId);
            records.push(Object.freeze({ identifier: childId, name: child.name, isSubSectionHeader: true }));
            for (const identifier of child.directIds) records.push(recordFor(state, identifier));
        }
    }
    return Object.freeze(records);
}

export function navigatorRows(pm) {
    const rows = readOrderedState(pm);
    const sources = new Map((pm?.serviceSettings?.prompts || []).map(prompt => [prompt.identifier, prompt]));
    return Object.freeze(rows.map(row => {
        const source = sources.get(row.identifier);
        return Object.freeze({
            identifier: row.identifier,
            name: row.name,
            role: typeof source?.role === 'string' ? source.role : '',
            enabled: row.enabled,
        });
    }));
}

export function headerRows(pm, manager) {
    const state = readConsumerState(pm, manager);
    return Object.freeze(state.index.sectionIds.map(identifier => {
        const section = state.index.getSection(identifier);
        return Object.freeze({
            identifier,
            name: section.name,
            isSubHeader: section.isSubHeader,
            parentId: section.parentId,
        });
    }));
}

function captureTicket(pm) {
    if (!pm?.activeCharacter || typeof pm.getPromptOrderForCharacter !== 'function') throw fail('native prompt order is unavailable.');
    const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
    if (!Array.isArray(order)) throw fail('native prompt order is unavailable.');
    return {
        pm,
        preset: pm.serviceSettings,
        prompts: pm.serviceSettings?.prompts,
        activeId: pm.activeCharacter.id,
        order,
        before: order.slice(),
    };
}

function current(ticket) {
    return ticket.pm?.serviceSettings === ticket.preset
        && ticket.pm?.serviceSettings?.prompts === ticket.prompts
        && ticket.pm?.activeCharacter?.id === ticket.activeId
        && ticket.pm?.getPromptOrderForCharacter?.(ticket.pm.activeCharacter) === ticket.order;
}

function assertCurrent(ticket) {
    if (!current(ticket)) throw fail('preset or active profile changed during movement.');
}

function restore(ticket) {
    ticket.order.splice(0, ticket.order.length, ...ticket.before);
}

function removeEntry(order, identifier) {
    const index = order.findIndex(entry => entry?.identifier === identifier);
    if (index < 0) throw fail(`prompt order entry is missing: ${identifier}`);
    return order.splice(index, 1)[0];
}

async function saveTicket(ticket, { render = false } = {}) {
    try {
        assertCurrent(ticket);
        if (render) ticket.pm.render?.();
        if (typeof ticket.pm.saveServiceSettings !== 'function') throw fail('native saveServiceSettings is unavailable.');
        await ticket.pm.saveServiceSettings();
        assertCurrent(ticket);
    } catch (error) {
        restore(ticket);
        if (current(ticket) && render) {
            try { ticket.pm.render?.(); } catch {}
        }
        throw error;
    }
}

export async function movePromptBelowHeader(pm, identifier, headerId, options = {}) {
    if (!identifier || !headerId || identifier === headerId) throw fail('invalid prompt/header movement request.');
    const ticket = captureTicket(pm);
    const entry = removeEntry(ticket.order, identifier);
    const headerIndex = ticket.order.findIndex(item => item?.identifier === headerId);
    if (headerIndex < 0) { restore(ticket); throw fail(`header is missing: ${headerId}`); }
    ticket.order.splice(headerIndex + 1, 0, entry);
    await saveTicket(ticket, options);
    return headerIndex + 1;
}

export async function movePromptToTopLevel(pm, manager, identifier, options = {}) {
    const ticket = captureTicket(pm);
    const state = readConsumerState(pm, manager);
    const headers = new Set(state.index.sectionIds);
    const entry = removeEntry(ticket.order, identifier);
    let insertIndex = ticket.order.findIndex(item => headers.has(item?.identifier));
    if (insertIndex < 0) insertIndex = ticket.order.length;
    ticket.order.splice(insertIndex, 0, entry);
    await saveTicket(ticket, options);
    return insertIndex;
}

export async function movePromptToSectionIndex(pm, manager, identifier, sectionId, newIndex = 0, options = {}) {
    if (sectionId === TOP_LEVEL_SECTION_ID) return movePromptToTopLevel(pm, manager, identifier, options);
    const state = readConsumerState(pm, manager);
    const section = state.index.getSection(sectionId);
    if (!section) throw fail(`section metadata is unavailable: ${sectionId}`);
    const ticket = captureTicket(pm);
    const entry = removeEntry(ticket.order, identifier);
    const members = section.memberIds.filter(id => id !== identifier);
    const bounded = Math.max(0, Math.min(Number.isInteger(newIndex) ? newIndex : 0, members.length));
    let insertIndex;
    if (members.length && bounded === 0) {
        insertIndex = ticket.order.findIndex(item => item?.identifier === members[0]);
    } else if (members.length) {
        const previousId = members[Math.min(bounded, members.length) - 1];
        const previousIndex = ticket.order.findIndex(item => item?.identifier === previousId);
        insertIndex = previousIndex < 0 ? -1 : previousIndex + 1;
    } else {
        const headerIndex = ticket.order.findIndex(item => item?.identifier === sectionId);
        insertIndex = headerIndex < 0 ? -1 : headerIndex + 1;
    }
    if (insertIndex < 0) { restore(ticket); throw fail('destination position is unavailable.'); }
    ticket.order.splice(insertIndex, 0, entry);
    await saveTicket(ticket, options);
    return insertIndex;
}

export async function movePromptToDirectSectionIndex(pm, manager, identifier, sectionId, newIndex = 0, options = {}) {
    const state = readConsumerState(pm, manager);
    const section = state.index.getSection(sectionId);
    if (!section) throw fail(`section metadata is unavailable: ${sectionId}`);
    const ticket = captureTicket(pm);
    const entry = removeEntry(ticket.order, identifier);
    const members = section.directIds.filter(id => id !== identifier);
    const bounded = Math.max(0, Math.min(Number.isInteger(newIndex) ? newIndex : 0, members.length));
    let insertIndex;
    if (members.length && bounded === 0) {
        insertIndex = ticket.order.findIndex(item => item?.identifier === members[0]);
    } else if (members.length) {
        const previousId = members[Math.min(bounded, members.length) - 1];
        const previousIndex = ticket.order.findIndex(item => item?.identifier === previousId);
        insertIndex = previousIndex < 0 ? -1 : previousIndex + 1;
    } else {
        const headerIndex = ticket.order.findIndex(item => item?.identifier === sectionId);
        insertIndex = headerIndex < 0 ? -1 : headerIndex + 1;
    }
    if (insertIndex < 0) { restore(ticket); throw fail('destination position is unavailable.'); }
    ticket.order.splice(insertIndex, 0, entry);
    await saveTicket(ticket, options);
    return insertIndex;
}

export async function reorderDirectSectionMembers(pm, manager, sectionId, orderedIds, options = {}) {
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'string' || !id)) throw fail('invalid reordered identifiers.');
    const state = readConsumerState(pm, manager);
    const section = state.index.getSection(sectionId);
    if (!section) throw fail(`section metadata is unavailable: ${sectionId}`);
    const expected = section.directIds;
    if (orderedIds.length !== expected.length || new Set(orderedIds).size !== orderedIds.length
        || orderedIds.some(id => !expected.includes(id))) throw fail('reordered identifiers do not match direct section membership.');
    const ticket = captureTicket(pm);
    const positions = expected.map(id => ticket.order.findIndex(entry => entry?.identifier === id));
    if (positions.some(index => index < 0)) throw fail('direct section member is missing from native order.');
    const entries = new Map(expected.map(id => [id, ticket.order.find(entry => entry?.identifier === id)]));
    const sortedPositions = positions.slice().sort((a, b) => a - b);
    orderedIds.forEach((id, index) => { ticket.order[sortedPositions[index]] = entries.get(id); });
    await saveTicket(ticket, options);
    return sortedPositions;
}

export async function reorderSectionMembers(pm, manager, sectionId, orderedIds, options = {}) {
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'string' || !id)) throw fail('invalid reordered identifiers.');
    const state = readConsumerState(pm, manager);
    const section = state.index.getSection(sectionId);
    if (!section) throw fail(`section metadata is unavailable: ${sectionId}`);
    const expected = section.memberIds;
    if (orderedIds.length !== expected.length || new Set(orderedIds).size !== orderedIds.length
        || orderedIds.some(id => !expected.includes(id))) throw fail('reordered identifiers do not match section membership.');
    const ticket = captureTicket(pm);
    const positions = expected.map(id => ticket.order.findIndex(entry => entry?.identifier === id));
    if (positions.some(index => index < 0)) throw fail('section member is missing from native order.');
    const entries = new Map(expected.map(id => [id, ticket.order.find(entry => entry?.identifier === id)]));
    const sortedPositions = positions.slice().sort((a, b) => a - b);
    orderedIds.forEach((id, index) => { ticket.order[sortedPositions[index]] = entries.get(id); });
    await saveTicket(ticket, options);
    return sortedPositions;
}
