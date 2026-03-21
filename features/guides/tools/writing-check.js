/**
 * Writing Check Tool
 * Gives the AI an explicit way to check writing quality metrics.
 * Returns a detailed report of repetitive phrases, overused words,
 * weak constructions, and structural issues.
 */

import { getToolSettings } from '../tool-registry.js';
import { formatAnalysisReport } from '../writing-analyzer.js';

export const TOOL_NAME = 'NG_writing_check';

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
    return {
        name: TOOL_NAME,
        displayName: 'Writing Check',
        description: 'Get a detailed writing quality report — repetitive phrases, overused words, weak constructions, and sentence structure issues detected across recent messages. Use this to self-audit your writing quality, identify patterns you should avoid, and ensure fresh, varied prose.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
        action: execute,
        formatMessage: () => 'Analyzing writing quality...',
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
        stealth: settings.stealth,
    };
}

async function execute() {
    return formatAnalysisReport();
}
