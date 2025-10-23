import { chat_completion_sources } from '../../../../../../../scripts/openai.js';

// Import shared prompts library (Integration Opportunity 3.2)
import sharedPromptsManager from '../../../core/shared-prompts.js';

export const EXTENSION_NAME = "ProsePolisher";
export const LOG_PREFIX = `[${EXTENSION_NAME}]`;
export const EXTENSION_FOLDER_PATH = 'scripts/extensions/third-party/NemoPresetExt/features/prosepolisher';
export const PROSE_POLISHER_ID_PREFIX = '_prosePolisherRule_';
export const GREMLIN_ROLES = ['papa', 'twins', 'mama', 'writer', 'auditor'];

// This map connects the API key to the DOM ID of the corresponding model dropdown in the main UI.
export const API_TO_SELECTOR_MAP = {
    [chat_completion_sources.OPENAI]: '#model_openai_select',
    [chat_completion_sources.CLAUDE]: '#model_claude_select',
    [chat_completion_sources.MAKERSUITE]: '#model_google_select',
    [chat_completion_sources.VERTEXAI]: '#model_vertexai_select',
    [chat_completion_sources.OPENROUTER]: '#model_openrouter_select',
    [chat_completion_sources.MISTRALAI]: '#model_mistralai_select',
    [chat_completion_sources.GROQ]: '#model_groq_select',
    [chat_completion_sources.COHERE]: '#model_cohere_select',
    [chat_completion_sources.AI21]: '#model_ai21_select',
    [chat_completion_sources.PERPLEXITY]: '#model_perplexity_select',
    [chat_completion_sources.DEEPSEEK]: '#model_deepseek_select',
    [chat_completion_sources.AIMLAPI]: '#model_aimlapi_select',
    [chat_completion_sources.XAI]: '#model_xai_select',
    [chat_completion_sources.ZEROONEAI]: '#model_01ai_select',
    [chat_completion_sources.POLLINATIONS]: '#model_pollinations_select',
    [chat_completion_sources.NANOGPT]: '#model_nanogpt_select',
    [chat_completion_sources.CUSTOM]: '#model_custom_select',
    [chat_completion_sources.MOONSHOT]: '#model_moonshot_select',
    [chat_completion_sources.FIREWORKS]: '#model_fireworks_select',
    [chat_completion_sources.COMETAPI]: '#model_cometapi_select',
    [chat_completion_sources.AZURE_OPENAI]: '#model_azure_openai_select',
    [chat_completion_sources.ELECTRONHUB]: '#model_electronhub_select',
};


export const DEFAULT_WRITER_INSTRUCTIONS_TEMPLATE = `You are a master writer. Follow the instructions from your project lead precisely.
**DO NOT** mention the blueprint or instructions in your reply.
Your writing should be creative and engaging.
**DO NOT** write from the user's perspective. Write **ONLY** the character's response.

# INSTRUCTIONS
{{BLUEPRINT}}`;
export const DEFAULT_AUDITOR_INSTRUCTIONS_TEMPLATE = `You are a master line editor. Your task is to revise and polish the following text.
Correct grammatical errors, awkward phrasing, and typos. Eliminate repetitive words and sentence structures. Enhance the prose to be more evocative and impactful, while respecting the established character voice.
If the text is fundamentally flawed, rewrite it to be high quality.

**CRUCIAL: YOUR OUTPUT MUST ONLY BE THE FINAL, EDITED TEXT.**
Do **NOT** include any commentary, explanations, or introductory phrases.

# TEXT TO EDIT
{{WRITER_PROSE}}`;

// Using a template literal (backticks) to prevent macro processing.
export const DEFAULT_REGEX_GENERATION_INSTRUCTIONS = `Create replacement rules for repetitive phrases.

For each phrase, create a JSON object with:
- scriptName: descriptive name
- findRegex: JavaScript regex with capture groups for pronouns
- replaceString: 15+ alternatives in {{random:alt1,alt2,alt3}} format

Use $1, $2 for captured pronoun groups.

Return only JSON array.`;

export const defaultSettings = {
    // Master Control
    enabled: true,

    // Prose Polisher - Regex & Learning
    isStaticEnabled: true,
    isDynamicEnabled: true,
    integrateWithGlobalRegex: true,
    dynamicTriggerCount: 25,
    regexGenerationInstructions: '',
    regexGenerationMethod: 'current',
    regexGeneratorRole: 'writer',
    regexTwinsCycles: 2,
    skipTriageCheck: false,

    // Prose Polisher - Analysis Engine (Optimized for better AI slop detection)
    slopThreshold: 3.0,
    leaderboardUpdateCycle: 8,
    pruningCycle: 30,
    ngramMax: 10,
    patternMinCommon: 2,

    // NemoLore Integration (Integration Opportunity 2.2)
    analyzeNemoLoreSummaries: true,

    // Project Gremlin - Pipeline
    projectGremlinEnabled: false,
    gremlinPapaEnabled: true,
    gremlinTwinsEnabled: true,
    gremlinMamaEnabled: true,
    gremlinTwinsIterations: 3,
    gremlinAuditorEnabled: false,

    gremlinPapaPreset: 'Default',
    gremlinPapaApi: 'google',
    gremlinPapaModel: 'gemini-2.5-flash',
    gremlinPapaSource: '',
    gremlinPapaCustomUrl: '',
    gremlinPapaProfile: '',
    gremlinPapaInstructions: '',

    gremlinTwinsPreset: 'Default',
    gremlinTwinsApi: 'google',
    gremlinTwinsModel: 'gemini-2.5-flash-lite-preview-06-17',
    gremlinTwinsSource: '',
    gremlinTwinsCustomUrl: '',
    gremlinTwinsProfile: '',
    gremlinTwinsVexInstructionsBase: '',
    gremlinTwinsVaxInstructionsBase: '',

    gremlinMamaPreset: 'Default',
    gremlinMamaApi: 'google',
    gremlinMamaModel: 'gemini-2.5-flash',
    gremlinMamaSource: '',
    gremlinMamaCustomUrl: '',
    gremlinMamaProfile: '',
    gremlinMamaInstructions: '',

    gremlinWriterPreset: 'Default',
    gremlinWriterApi: '',
    gremlinWriterModel: '',
    gremlinWriterSource: '',
    gremlinWriterCustomUrl: '',
    gremlinWriterInstructionsTemplate: '',
    gremlinWriterChaosModeEnabled: false,
    gremlinWriterChaosOptions: [],

    gremlinAuditorPreset: 'Default',
    gremlinAuditorApi: '',
    gremlinAuditorModel: '',
    gremlinAuditorSource: '',
    gremlinAuditorCustomUrl: '',
    gremlinAuditorInstructionsTemplate: '',
    blacklist: {
        'a small smile': 2,
        'a faint blush': 2,
        "couldn't help but": 3,
        'a sense of': 2,
        'began to': 3,
        'in turn': 2,
        'in response': 2,
        'let out a': 2,
        'a bit': 2,
        'a little': 2,
        'seemed to': 2,
        'somehow': 2,
        'slightly': 2,
        'gaze': 2,
        'smirk': 3,
        'chuckle': 2,
        'nod': 2,
        'shrug': 2,
        'sigh': 2,
        'glance': 2,
        'wink': 2,
        'grin': 2,
        'shiver': 3,
        'quiver': 3,
        'tremble': 3,
        'flutter': 2,
        'murmur': 2,
        'whisper': 3,
        'mutter': 2,
    },
};

/**
 * Helper function to get prompt from shared library (Integration Opportunity 3.2)
 * Falls back to default if shared prompt not available
 * @param {string} promptId - Shared prompt ID
 * @param {string} defaultPrompt - Fallback prompt text
 * @returns {string} Prompt text
 */
export function getSharedPromptOrDefault(promptId, defaultPrompt) {
    if (sharedPromptsManager) {
        const sharedPrompt = sharedPromptsManager.getPrompt(promptId);
        if (sharedPrompt) {
            console.log(`${LOG_PREFIX} Using shared prompt: ${sharedPrompt.name}`);
            return sharedPrompt.template;
        }
    }
    return defaultPrompt;
}