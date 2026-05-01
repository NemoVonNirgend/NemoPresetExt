import { eventSource, event_types } from '../../../../../../script.js';
import { promptManager as importedPromptManager } from '../../../../../openai.js';

const GITHUB_API_ROOT = 'https://api.github.com/repos/NemoVonNirgend/NemoEngine/contents/';
const GITHUB_REF = 'main';
const PROMPT_FILE_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yaml', '.yml']);
const DEFAULT_ROLE = 'system';

export const PROMPT_LIBRARY_SOURCES = [
    {
        id: 'nemo-engine',
        name: 'Nemo Engine',
        description: 'Core NemoEngine prompt modules.',
        icon: 'fa-brain',
        repoPath: 'Nemo Engine/Prompts',
        url: 'https://github.com/NemoVonNirgend/NemoEngine/tree/main/Nemo%20Engine/Prompts',
    },
    {
        id: 'nemonet',
        name: 'NemoNet',
        description: 'Reasoning-focused NemoNet prompt modules.',
        icon: 'fa-network-wired',
        repoPath: 'NemoNet/Prompts',
        url: 'https://github.com/NemoVonNirgend/NemoEngine/tree/main/NemoNet/Prompts',
    },
    {
        id: 'atelier',
        name: 'Atelier',
        description: 'Atelier creative prompt modules.',
        icon: 'fa-palette',
        repoPath: 'Atelier/Prompts',
        url: 'https://github.com/NemoVonNirgend/NemoEngine/tree/main/Atelier/Prompts',
    },
];

export async function loadPromptLibrary() {
    const sourceResults = await Promise.allSettled(PROMPT_LIBRARY_SOURCES.map(source => loadSourceFiles(source)));
    const files = [];
    const errors = [];

    sourceResults.forEach((result, index) => {
        const source = PROMPT_LIBRARY_SOURCES[index];
        if (result.status === 'fulfilled') {
            files.push(...result.value);
        } else {
            errors.push(`${source.name}: ${result.reason?.message || 'Unable to load prompt list'}`);
        }
    });

    return { files, errors };
}

export async function loadPromptBundle(file) {
    if (!file?.downloadUrl) {
        throw new Error('Prompt file is missing a download URL.');
    }

    const response = await fetch(file.downloadUrl, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`GitHub returned ${response.status} while loading ${file.name}.`);
    }

    const content = await response.text();
    return parsePromptBundle(file, content);
}

export async function importPromptBundle(bundle) {
    const promptManager = getPromptManager();
    if (!promptManager) {
        throw new Error('SillyTavern PromptManager is not available yet.');
    }

    const prompts = normalizePrompts(bundle.prompts, bundle);
    if (prompts.length === 0) {
        throw new Error('No importable prompts were found in this file.');
    }

    const orderEntries = buildPromptOrderEntries(prompts, bundle.promptOrder);
    let added = 0;
    let updated = 0;

    prompts.forEach(prompt => {
        const existingPrompt = promptManager.getPromptById(prompt.identifier);
        if (existingPrompt) {
            Object.assign(existingPrompt, prompt);
            updated++;
        } else {
            promptManager.addPrompt(prompt, prompt.identifier);
            added++;
        }
    });

    movePromptEntriesToTop(orderEntries);

    await Promise.resolve(promptManager.saveServiceSettings());
    promptManager.render();
    eventSource.emit(event_types.OAI_PRESET_CHANGED_AFTER);

    return {
        total: prompts.length,
        added,
        updated,
        names: prompts.map(prompt => prompt.name || prompt.identifier),
    };
}

async function loadSourceFiles(source) {
    const entries = await fetchGithubDirectory(source.repoPath);
    return entries
        .filter(entry => isPromptFile(entry))
        .map(entry => ({
            id: `${source.id}:${entry.path}`,
            sourceId: source.id,
            sourceName: source.name,
            sourceIcon: source.icon,
            sourceUrl: source.url,
            name: entry.name,
            title: filenameToTitle(entry.name),
            path: entry.path,
            url: buildGithubBlobUrl(entry.path),
            downloadUrl: entry.download_url || buildRawGithubUrl(entry.path),
            extension: getFileExtension(entry.name).replace('.', '').toUpperCase(),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

async function fetchGithubDirectory(repoPath, depth = 0) {
    if (depth > 3) return [];

    const response = await fetch(`${GITHUB_API_ROOT}${encodeRepoPath(repoPath)}?ref=${GITHUB_REF}`, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}`);
    }

    const entries = await response.json();
    if (!Array.isArray(entries)) {
        return [];
    }

    const nested = await Promise.all(entries.map(async entry => {
        if (entry.type === 'dir') {
            return fetchGithubDirectory(entry.path, depth + 1);
        }
        return [entry];
    }));

    return nested.flat();
}

function parsePromptBundle(file, content) {
    const baseBundle = {
        sourceFile: file,
        prompts: [],
        promptOrder: null,
    };

    try {
        const parsed = JSON.parse(content);
        return parseJsonPromptBundle(parsed, baseBundle);
    } catch {
        return {
            ...baseBundle,
            prompts: [createPromptFromText(file, content)],
        };
    }
}

function parseJsonPromptBundle(parsed, baseBundle) {
    if (parsed?.type === 'nemo_prompt_archive' && parsed.archive?.promptData?.prompts) {
        return {
            ...baseBundle,
            prompts: parsed.archive.promptData.prompts,
            promptOrder: parsed.archive.promptData.prompt_order,
        };
    }

    if (parsed?.data?.prompts) {
        return {
            ...baseBundle,
            prompts: parsed.data.prompts,
            promptOrder: parsed.data.prompt_order,
        };
    }

    if (Array.isArray(parsed?.prompts)) {
        return {
            ...baseBundle,
            prompts: parsed.prompts,
            promptOrder: parsed.prompt_order,
        };
    }

    if (Array.isArray(parsed)) {
        return {
            ...baseBundle,
            prompts: parsed,
        };
    }

    if (isPromptLikeObject(parsed)) {
        return {
            ...baseBundle,
            prompts: [parsed],
        };
    }

    return {
        ...baseBundle,
        prompts: [createPromptFromText(baseBundle.sourceFile, JSON.stringify(parsed, null, 2))],
    };
}

function normalizePrompts(prompts, bundle) {
    const sourceFile = bundle.sourceFile;
    return prompts
        .filter(prompt => prompt && typeof prompt === 'object')
        .map((prompt, index) => normalizePrompt(prompt, sourceFile, index))
        .filter(prompt => prompt.content || prompt.name);
}

function normalizePrompt(prompt, sourceFile, index) {
    const name = String(prompt.name || prompt.title || filenameToTitle(sourceFile.name)).trim();
    const content = String(prompt.content ?? prompt.prompt ?? prompt.text ?? '').trim();
    const identifier = String(prompt.identifier || prompt.id || createPromptIdentifier(sourceFile, index, name)).trim();

    return {
        identifier,
        name,
        role: prompt.role || DEFAULT_ROLE,
        content,
        system_prompt: prompt.system_prompt === true,
        marker: prompt.marker === true,
        enabled: prompt.enabled === true,
        injection_position: prompt.injection_position ?? 0,
        injection_depth: prompt.injection_depth ?? 4,
        injection_order: prompt.injection_order ?? 100,
        forbid_overrides: prompt.forbid_overrides === true,
        ...prompt,
        identifier,
        name,
        content,
    };
}

function createPromptFromText(file, content) {
    return {
        identifier: createPromptIdentifier(file, 0, file.title),
        name: file.title,
        role: DEFAULT_ROLE,
        content: content.trim(),
        system_prompt: false,
        marker: false,
        enabled: true,
    };
}

function buildPromptOrderEntries(prompts, promptOrder) {
    const sourceOrder = normalizePromptOrder(promptOrder);
    const orderByIdentifier = new Map(sourceOrder.map(entry => [entry.identifier, entry]));
    const orderedPrompts = [
        ...sourceOrder
            .map(entry => prompts.find(prompt => prompt.identifier === entry.identifier))
            .filter(Boolean),
        ...prompts.filter(prompt => !orderByIdentifier.has(prompt.identifier)),
    ];

    return orderedPrompts.map(prompt => {
        const sourceEntry = orderByIdentifier.get(prompt.identifier);
        return {
            identifier: prompt.identifier,
            enabled: sourceEntry?.enabled ?? true,
        };
    });
}

function normalizePromptOrder(promptOrder) {
    if (Array.isArray(promptOrder)) {
        if (promptOrder.every(entry => entry?.identifier)) {
            return promptOrder;
        }

        const firstCharacterOrder = promptOrder.find(entry => Array.isArray(entry?.order));
        return firstCharacterOrder?.order || [];
    }

    if (Array.isArray(promptOrder?.order)) {
        return promptOrder.order;
    }

    return [];
}

function movePromptEntriesToTop(entries) {
    const promptManager = getPromptManager();
    const activeCharacter = promptManager.activeCharacter;
    if (!activeCharacter) {
        throw new Error('No active prompt list is available. Open a chat or preset before importing prompts.');
    }

    const promptOrder = getOrCreatePromptOrder(promptManager, activeCharacter);
    if (!Array.isArray(promptOrder)) return;

    entries.forEach(entry => {
        const index = promptOrder.findIndex(current => current.identifier === entry.identifier);
        if (index !== -1) {
            promptOrder.splice(index, 1);
        }
    });

    promptOrder.unshift(...entries);
}

function getPromptManager() {
    return (typeof window !== 'undefined' && window.promptManager) || importedPromptManager;
}

function getOrCreatePromptOrder(promptManager, activeCharacter) {
    promptManager.serviceSettings.prompt_order = promptManager.serviceSettings.prompt_order ?? [];
    const existingList = promptManager.serviceSettings.prompt_order.find(list => String(list.character_id) === String(activeCharacter.id));
    if (existingList) {
        return existingList.order;
    }

    promptManager.addPromptOrderForCharacter(activeCharacter, []);
    return promptManager.getPromptOrderForCharacter(activeCharacter);
}

function isPromptFile(entry) {
    return entry.type === 'file' && PROMPT_FILE_EXTENSIONS.has(getFileExtension(entry.name));
}

function isPromptLikeObject(value) {
    return value && typeof value === 'object' && (
        'content' in value ||
        'prompt' in value ||
        'text' in value ||
        'identifier' in value ||
        'name' in value
    );
}

function createPromptIdentifier(file, index, name) {
    return `nemo_marketplace_${file.sourceId}_${slugify(file.path || name)}_${index + 1}`;
}

function filenameToTitle(filename) {
    return filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getFileExtension(filename) {
    const match = String(filename || '').match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : '';
}

function encodeRepoPath(repoPath) {
    return repoPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function buildGithubBlobUrl(repoPath) {
    return `https://github.com/NemoVonNirgend/NemoEngine/blob/${GITHUB_REF}/${encodeRepoPath(repoPath)}`;
}

function buildRawGithubUrl(repoPath) {
    return `https://raw.githubusercontent.com/NemoVonNirgend/NemoEngine/${GITHUB_REF}/${encodeRepoPath(repoPath)}`;
}

function slugify(value) {
    return String(value || 'prompt')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'prompt';
}
