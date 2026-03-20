import { ApiRouter } from './api-router.js';
import { ConnectionPool } from './connection-pool.js';
import { PipelinePresets } from './pipeline-presets.js';
import { PipelinePrompts } from './pipeline-prompts.js';
import logger from '../../core/logger.js';

/**
 * Pipeline execution state for tracking progress.
 */
let currentExecution = null;

/**
 * Ensure a connection exists in the pool. If the connectionId uses the
 * source::model format (from DOM provider selects), auto-register it
 * as a temporary connection so ApiRouter can resolve it.
 * @param {string|null} connectionId
 * @returns {string|null}
 */
function ensureConnection(connectionId) {
    if (!connectionId) return connectionId;

    // Already a registered connection?
    if (ConnectionPool.get(connectionId)) return connectionId;

    // Parse source::model format
    if (connectionId.includes('::')) {
        const [source, model] = connectionId.split('::', 2);
        ConnectionPool.register({
            id: connectionId,
            source,
            model,
            label: `${model} (${source})`,
            priority: 5,
            enabled: true,
            tags: ['auto'],
        });
        return connectionId;
    }

    return connectionId; // Let it fail naturally if not found
}

/**
 * Status callback type.
 * @callback StatusCallback
 * @param {string} stage - Current stage name
 * @param {string} status - Status message
 * @param {object} [data] - Optional data (timings, partial results)
 */

export const ModelPipeline = {
    /**
     * Execute a full pipeline run.
     *
     * @param {object} options
     * @param {string} options.presetId - Pipeline preset to use
     * @param {string} options.systemPrompt - Full system/character prompt
     * @param {Array<{role: string, content: string}>} options.messages - Conversation messages
     * @param {string} [options.userName='{{user}}'] - User's name for template substitution
     * @param {StatusCallback} [options.onStatus] - Progress callback
     * @returns {Promise<{
     *   text: string,
     *   recall: string,
     *   analysis: string,
     *   drafts: Array<{label: string, text: string, connectionId: string, error?: string}>,
     *   timings: {recall_ms: number, analysis_ms: number, drafts_ms: number, consolidation_ms: number, total_ms: number},
     *   error?: string
     * }>}
     */
    async execute({ presetId, systemPrompt, messages, userName = '{{user}}', onStatus }) {
        const preset = PipelinePresets.get(presetId);
        if (!preset) throw new Error(`Pipeline preset not found: ${presetId}`);

        const status = (stage, msg, data) => {
            logger.info(`Pipeline [${stage}]: ${msg}`);
            if (onStatus) onStatus(stage, msg, data);
        };

        const totalStart = Date.now();
        const timings = {};

        currentExecution = { presetId, startedAt: totalStart, stage: 'recall' };

        try {
            // ============================================
            // STAGE 1: Recall + Character Analysis (parallel)
            // ============================================
            status('recall', 'Starting recall + character analysis...');
            const stage1Start = Date.now();

            const recallMessages = PipelinePrompts.buildRecallMessages(systemPrompt, messages);
            const analysisMessages = PipelinePrompts.buildAnalysisMessages(systemPrompt, messages);

            // Ensure connections are registered (handles source::model format)
            ensureConnection(preset.recall.connectionId);
            ensureConnection(preset.analysis.connectionId);

            // Run recall and analysis in parallel
            const [recallResult, analysisResult] = await Promise.all([
                ApiRouter.send(preset.recall.connectionId, recallMessages, {
                    temperature: preset.recall.temperature,
                    max_tokens: preset.recall.max_tokens,
                }),
                ApiRouter.send(preset.analysis.connectionId, analysisMessages, {
                    temperature: preset.analysis.temperature,
                    max_tokens: preset.analysis.max_tokens,
                }),
            ]);

            timings.recall_ms = Date.now() - stage1Start;

            if (recallResult.error) {
                status('recall', `Recall failed: ${recallResult.error}`);
            } else {
                status('recall', 'Recall complete', { chars: recallResult.text.length });
            }

            if (analysisResult.error) {
                status('analysis', `Analysis failed: ${analysisResult.error}`);
            } else {
                status('analysis', 'Analysis complete', { chars: analysisResult.text.length });
            }

            const recallText = recallResult.text || '(Recall failed - proceeding without context)';
            const analysisText = analysisResult.text || '(Analysis failed - proceeding without analysis)';

            currentExecution.stage = 'drafters';

            // ============================================
            // STAGE 2: Parallel Drafters
            // ============================================
            status('drafters', `Starting ${preset.drafters.length} parallel drafters...`);
            const stage2Start = Date.now();

            const drafterMessages = PipelinePrompts.buildDrafterMessages(
                systemPrompt, messages, recallText, analysisText, userName,
            );

            // Ensure drafter connections are registered
            preset.drafters.filter(d => d.connectionId).forEach(d => ensureConnection(d.connectionId));

            // Send to all drafters in parallel
            const drafterPromises = preset.drafters
                .filter(d => d.connectionId) // Skip unconfigured slots
                .map(drafter =>
                    ApiRouter.send(drafter.connectionId, drafterMessages, {
                        temperature: drafter.temperature,
                        max_tokens: drafter.max_tokens,
                    }).then(result => {
                        status('drafters', `Draft ${drafter.label} complete`, {
                            connectionId: drafter.connectionId,
                            chars: result.text?.length || 0,
                            error: result.error,
                        });
                        return { ...result, label: drafter.label };
                    }),
                );

            const drafterResults = await Promise.all(drafterPromises);
            timings.drafts_ms = Date.now() - stage2Start;

            // Collect successful drafts
            const successfulDrafts = drafterResults
                .filter(d => d.text && !d.error)
                .map(d => ({ label: d.label, text: d.text, connectionId: d.connectionId }));

            const failedDrafts = drafterResults.filter(d => d.error);
            if (failedDrafts.length > 0) {
                status('drafters', `${failedDrafts.length} drafter(s) failed`, {
                    failed: failedDrafts.map(d => ({ label: d.label, error: d.error })),
                });
            }

            status('drafters', `${successfulDrafts.length}/${preset.drafters.length} drafts collected`);

            if (successfulDrafts.length === 0) {
                return {
                    text: '',
                    recall: recallText,
                    analysis: analysisText,
                    drafts: drafterResults,
                    timings: { ...timings, total_ms: Date.now() - totalStart },
                    error: 'All drafters failed — no drafts to consolidate',
                };
            }

            // If only 1 draft succeeded, return it directly (no consolidation needed)
            if (successfulDrafts.length === 1) {
                status('consolidation', 'Only 1 draft available — skipping consolidation');
                timings.consolidation_ms = 0;
                return {
                    text: successfulDrafts[0].text,
                    recall: recallText,
                    analysis: analysisText,
                    drafts: drafterResults,
                    timings: { ...timings, total_ms: Date.now() - totalStart },
                };
            }

            currentExecution.stage = 'consolidation';

            // ============================================
            // STAGE 3: Consolidation
            // ============================================
            status('consolidation', 'Starting consolidation...');
            const stage3Start = Date.now();

            const consolidationMessages = PipelinePrompts.buildConsolidationMessages(
                systemPrompt, messages, analysisText, successfulDrafts, userName,
            );

            ensureConnection(preset.consolidator.connectionId);
            const consolidationResult = await ApiRouter.send(
                preset.consolidator.connectionId,
                consolidationMessages,
                {
                    temperature: preset.consolidator.temperature,
                    max_tokens: preset.consolidator.max_tokens,
                },
            );

            timings.consolidation_ms = Date.now() - stage3Start;
            timings.total_ms = Date.now() - totalStart;

            if (consolidationResult.error) {
                status('consolidation', `Consolidation failed: ${consolidationResult.error}`);
                // Fall back to best draft
                const fallbackDraft = successfulDrafts[0];
                return {
                    text: fallbackDraft.text,
                    recall: recallText,
                    analysis: analysisText,
                    drafts: drafterResults,
                    timings,
                    error: `Consolidation failed (${consolidationResult.error}), using Draft ${fallbackDraft.label} as fallback`,
                };
            }

            // Strip <think> tags from final output
            let finalText = consolidationResult.text;
            const thinkEnd = finalText.indexOf('</think>');
            if (thinkEnd !== -1) {
                finalText = finalText.substring(thinkEnd + '</think>'.length).trim();
            }

            status('consolidation', 'Pipeline complete', { timings });

            return {
                text: finalText,
                recall: recallText,
                analysis: analysisText,
                drafts: drafterResults,
                timings,
            };

        } finally {
            currentExecution = null;
        }
    },

    /**
     * Get the current execution state (if a pipeline is running).
     * @returns {object|null}
     */
    getExecutionState() {
        return currentExecution ? { ...currentExecution } : null;
    },

    /**
     * Check if a preset is fully configured (all connection IDs set and available).
     * @param {string} presetId
     * @returns {Promise<{configured: boolean, missing: string[]}>}
     */
    async validatePreset(presetId) {
        const preset = PipelinePresets.get(presetId);
        if (!preset) return { configured: false, missing: ['Preset not found'] };

        const missing = [];

        // Check recall
        if (!preset.recall.connectionId) missing.push('Recall model');
        else {
            ensureConnection(preset.recall.connectionId);
            if (!ConnectionPool.get(preset.recall.connectionId)) missing.push(`Recall: connection "${preset.recall.connectionId}" not found`);
        }

        // Check analysis
        if (!preset.analysis.connectionId) missing.push('Analysis model');
        else {
            ensureConnection(preset.analysis.connectionId);
            if (!ConnectionPool.get(preset.analysis.connectionId)) missing.push(`Analysis: connection "${preset.analysis.connectionId}" not found`);
        }

        // Check drafters
        const configuredDrafters = preset.drafters.filter(d => d.connectionId);
        if (configuredDrafters.length === 0) missing.push('At least 1 drafter must be configured');
        for (const d of configuredDrafters) {
            ensureConnection(d.connectionId);
            if (!ConnectionPool.get(d.connectionId)) {
                missing.push(`Drafter ${d.label}: connection "${d.connectionId}" not found`);
            }
        }

        // Check consolidator
        if (!preset.consolidator.connectionId) missing.push('Consolidator model');
        else {
            ensureConnection(preset.consolidator.connectionId);
            if (!ConnectionPool.get(preset.consolidator.connectionId)) missing.push(`Consolidator: connection "${preset.consolidator.connectionId}" not found`);
        }

        // Check API key availability for all referenced connections
        const allConnectionIds = [
            preset.recall.connectionId,
            preset.analysis.connectionId,
            ...configuredDrafters.map(d => d.connectionId),
            preset.consolidator.connectionId,
        ].filter(Boolean);

        const uniqueIds = [...new Set(allConnectionIds)];
        for (const id of uniqueIds) {
            const conn = ConnectionPool.get(id);
            if (conn) {
                const hasKey = await ConnectionPool.checkAvailability(id);
                if (!hasKey) missing.push(`API key missing for ${conn.source} (${id})`);
            }
        }

        return { configured: missing.length === 0, missing };
    },

    /**
     * Quick helper to set up a preset with connections from the pool.
     * @param {string} presetId
     * @param {object} config - { recall: connectionId, analysis: connectionId, drafters: [connectionId, ...], consolidator: connectionId }
     */
    configurePreset(presetId, config) {
        const preset = PipelinePresets.get(presetId);
        if (!preset) throw new Error(`Preset not found: ${presetId}`);

        const updated = JSON.parse(JSON.stringify(preset));

        if (config.recall) updated.recall.connectionId = config.recall;
        if (config.analysis) updated.analysis.connectionId = config.analysis;
        if (config.consolidator) updated.consolidator.connectionId = config.consolidator;
        if (config.drafters) {
            config.drafters.forEach((connId, i) => {
                if (i < updated.drafters.length && connId) {
                    updated.drafters[i].connectionId = connId;
                }
            });
        }

        PipelinePresets.save(updated);
        return updated;
    },
};
