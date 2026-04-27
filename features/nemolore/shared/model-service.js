import { ConnectionManagerRequestService } from '../../../../../shared.js';
import { ApiRouter } from '../../connection/api-router.js';
import { ModelPipeline } from '../../connection/model-pipeline.js';
import { PipelinePresets } from '../../connection/pipeline-presets.js';

export const ACTIVE_NEMOSTACK_PRESET = '__active__';

export function getSupportedConnectionProfiles() {
    return ConnectionManagerRequestService.getSupportedProfiles();
}

export async function runProfileRequest(profileId, messages, maxTokens, options = {}) {
    return await ConnectionManagerRequestService.sendRequest(
        profileId,
        messages,
        maxTokens,
        {
            stream: false,
            extractData: true,
            includePreset: true,
            includeInstruct: true,
            ...options,
        },
    );
}

export function getProfileResponseText(response) {
    if (typeof response === 'string') {
        return response;
    }

    return response?.content ?? response?.text ?? response?.message ?? JSON.stringify(response);
}

export async function runProfilePrompt(profileId, prompt, {
    systemPrompt = 'You are a helpful creative writing assistant. Follow the instructions precisely.',
    maxTokens = 2000,
    ...options
} = {}) {
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    const response = await runProfileRequest(profileId, messages, maxTokens, options);
    return getProfileResponseText(response);
}

export async function runConnectionMessages(connectionId, messages, options = {}) {
    const result = await ApiRouter.send(connectionId, messages, options);

    if (result?.error) {
        throw new Error(`ApiRouter: ${result.error}`);
    }

    return result;
}

export async function runConnectionPrompt(connectionId, prompt, {
    systemPrompt = 'You are a helpful creative writing assistant. Follow the instructions precisely.',
    maxTokens = 2000,
    temperature = 0.7,
    ...options
} = {}) {
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    return await runConnectionMessages(connectionId, messages, {
        max_tokens: maxTokens,
        temperature,
        ...options,
    });
}

export function getNemoStackPresetOptions() {
    return Object.values(PipelinePresets.getAll()).map(preset => ({
        id: preset.id,
        name: preset.name || preset.id,
        description: preset.description || '',
    }));
}

export function resolveNemoStackPresetId(presetId) {
    const selected = String(presetId || '').trim();
    if (!selected) return '';
    if (selected === ACTIVE_NEMOSTACK_PRESET) {
        return PipelinePresets.getActiveId() || 'nemo-stack';
    }
    return selected;
}

export function getNemoStackPresetLabel(presetId) {
    const resolved = resolveNemoStackPresetId(presetId);
    if (!resolved) return '';

    const preset = PipelinePresets.get(resolved);
    if (!preset) return resolved;

    if (presetId === ACTIVE_NEMOSTACK_PRESET) {
        return `Active NemoStack preset (${preset.name || resolved})`;
    }

    return preset.name || resolved;
}

export async function validateNemoStackPreset(presetId) {
    const resolvedPresetId = resolveNemoStackPresetId(presetId);
    if (!resolvedPresetId) {
        return {
            configured: false,
            missing: ['No NemoStack preset selected'],
            resolvedPresetId: '',
        };
    }

    const result = await ModelPipeline.validatePreset(resolvedPresetId);
    return { ...result, resolvedPresetId };
}

export async function runNemoStackPipeline({ presetId, systemPrompt, messages, userName, onStatus }) {
    const resolvedPresetId = resolveNemoStackPresetId(presetId);
    if (!resolvedPresetId) {
        throw new Error('No NemoStack preset selected.');
    }

    return await ModelPipeline.execute({
        presetId: resolvedPresetId,
        systemPrompt,
        messages,
        userName,
        onStatus,
    });
}
