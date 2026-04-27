import { NEMO_EXTENSION_NAME } from '../../core/utils.js';

export const LOG_PREFIX = '[NemoLore]';
export const FEATURE_SETTINGS_KEY = 'nemoLore';
export const FEATURE_PATH = `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/features/nemolore`;
export const PROMPT_TAG = 'nemo_lore_timeline';
export const RETRIEVAL_PROMPT_TAG = 'nemo_lore_retrieved_archive';
export const PREFERENCES_PROMPT_TAG = 'nemo_lore_preferences';
export const PREFERENCES_VARIABLE_NAME = 'NemoLorePreferences';
export const GUIDES_TOOL_RESULTS_VARIABLE_NAME = 'NemoGuidesToolResults';
export const STORE_PREFIX = 'nemo_lore';
export const STYLE_ELEMENT_ID = 'nemo-lore-feature-styles';

export const DEFAULT_SETTINGS = {
    enabled: false,
    backgroundEnabled: true,
    memoryProfileId: '',
    liveWindowMessages: 8,
    maxSummaryTokens: 384,
    injectionDepth: 4,
    hideAfterMessages: 12,
    autoHideSummarized: false,
    vectorEnabled: false,
    retrievalCount: 3,
    retrievalDepth: 3,
    vectorThreshold: 0.25,
    preferencesEnabled: true,
    inferenceEnabled: true,
    selectionProblemMenu: true,
    preferenceDepth: 2,
    preferenceVariableName: PREFERENCES_VARIABLE_NAME,
    preferenceLimit: 8,
    inferenceThreshold: 3,
    managedWorld: '',
    template: '[NemoLore condensed earlier conversation]\n{{summaries}}',
    retrievalTemplate: '[NemoLore relevant archived details]\n{{snippets}}',
    preferenceTemplate: 'NemoLore Cross-Chat User Preferences\n{{preferences}}',
};

export const NGRAM_MIN = 2;
export const NGRAM_MAX = 5;
export const SINGLE_WORD_SIGNAL_MIN_LENGTH = 6;
export const PREFERENCE_SIGNAL_LIMIT = 80;
export const PREFERENCE_COMMON_WORDS = new Set([
    'about', 'after', 'again', 'against', 'almost', 'along', 'already', 'always', 'another', 'around',
    'because', 'before', 'being', 'between', 'both', 'could', 'down', 'even', 'every', 'from',
    'have', 'having', 'here', 'hers', 'himself', 'into', 'itself', 'just', 'like', 'little',
    'might', 'more', 'most', 'never', 'only', 'other', 'over', 'quite', 'really', 'should',
    'still', 'their', 'theirs', 'there', 'these', 'thing', 'those', 'through', 'under', 'until',
    'very', 'want', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
    'your', 'yours', 'character', 'message', 'response', 'said', 'says', 'asked', 'looked',
    'eyes', 'face', 'hand', 'hands', 'voice', 'body', 'head', 'heart', 'breath', 'moment',
]);
export const PREFERENCE_LEMMA_MAP = new Map([
    ['eyes', 'eye'], ['hands', 'hand'], ['fingers', 'finger'], ['lips', 'lip'], ['cheeks', 'cheek'],
    ['shoulders', 'shoulder'], ['thoughts', 'thought'], ['moments', 'moment'], ['steps', 'step'],
    ['features', 'feature'], ['voices', 'voice'], ['tears', 'tear'], ['smiled', 'smile'],
    ['smiling', 'smile'], ['looked', 'look'], ['looking', 'look'], ['seemed', 'seem'],
    ['seems', 'seem'], ['felt', 'feel'], ['feeling', 'feel'], ['said', 'say'], ['saying', 'say'],
    ['whispered', 'whisper'], ['whispers', 'whisper'], ['whispering', 'whisper'], ['shivered', 'shiver'],
    ['shivers', 'shiver'], ['shivering', 'shiver'], ['trembled', 'tremble'], ['trembling', 'tremble'],
    ['flushed', 'flush'], ['flushing', 'flush'], ['blushed', 'blush'], ['blushing', 'blush'],
    ['darkened', 'darken'], ['darkening', 'darken'], ['softened', 'soften'], ['softening', 'soften'],
    ['tightened', 'tighten'], ['tightening', 'tighten'], ['stilled', 'still'], ['stilling', 'still'],
]);

