import { getContext, extension_settings, getApiUrl, doExtrasFetch, modules } from '../../../../../extensions.js';
import { getRequestHeaders, saveSettings, saveSettingsDebounced, substituteParams, eventSource, event_types, generateQuietPrompt } from '../../../../../../script.js';
import { isJsonSchemaSupported } from '../../../../../textgen-settings.js';
import {
    trimToEndSentence,
    trimToStartSentence,
    onlyUnique } from '../../../../../utils.js';
import {
    DEBUG_PREFIX,
    DEFAULT_EXPRESSION_MAPPING,
    FALLBACK_EXPRESSION,
    CLASSIFY_EXPRESSIONS
} from './constants.js';
import Fuse from './lib/fuse.js';
export {
    delay,
    currentChatMembers,
    loadAnimationUi,
    getExpressionLabel
};

const delay = ms => new Promise(res => setTimeout(res, ms));

// Expression extension code
const EXPRESSION_API = {
    local: 0,
    extras: 1,
    llm: 2,
};
let expressionsList = null;
let inApiCall = false;

function currentChatMembers() {
    const context = getContext();
    const group_id = context.groupId;
    let chat_members = [context.name2];

    if (group_id !== null) {
        chat_members = [];
        for(const i of context.groups) {
            if (i.id == context.groupId) {
                for(const j of i.members) {
                    let char_name = j.replace(/\.[^/.]+$/, '');
                    if (char_name.includes('default_'))
                        char_name = char_name.substring('default_'.length);

                    chat_members.push(char_name);
                }
            }
        }
    }

    chat_members.sort();

    return chat_members;
}

function loadAnimationUi(type, use_default_settings, model_expressions, model_motions, expression_select_id, motion_select_id, expression_select_value, motion_select_value) {
    // Validate inputs
    if (!type || !expression_select_id || !motion_select_id) {
        console.error(DEBUG_PREFIX, 'Invalid parameters for loadAnimationUi');
        return;
    }
    
    // Ensure arrays exist and are valid
    const safeExpressions = Array.isArray(model_expressions) ? model_expressions : [];
    const safeMotions = Array.isArray(model_motions) ? model_motions : [];
    
    try {
        $(`#${expression_select_id}`)
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select expression</option>');

        $(`#${motion_select_id}`)
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select motion</option>');

        for (const expression of safeExpressions) {
            if (expression && typeof expression === 'string') {
                $(`#${expression_select_id}`).append(new Option(expression, expression));
            }
        }

        for (const motion of safeMotions) {
            if (motion && typeof motion === 'string') {
                const name = motion.substring(motion.lastIndexOf('/') + 1).replace(/\.(fbx|bvh)$/i, '');
                $(`#${motion_select_id}`).append(new Option(name, motion));
            }
        }

        // Set values safely
        if (expression_select_value) {
            $(`#${expression_select_id}`).val(expression_select_value);
        }
        if (motion_select_value) {
            $(`#${motion_select_id}`).val(motion_select_value);
        }

        if (use_default_settings && DEFAULT_EXPRESSION_MAPPING[type]) {
            if (safeExpressions.includes(DEFAULT_EXPRESSION_MAPPING[type])) {
                $(`#${expression_select_id}`).val(DEFAULT_EXPRESSION_MAPPING[type]);
            }
        }
    } catch (error) {
        console.error(DEBUG_PREFIX, 'Error in loadAnimationUi:', error);
    }
}

// Copied from expression extension
async function getExpressionsList() {
    // Return cached list if available
    if (Array.isArray(expressionsList)) {
        return [...expressionsList, ...extension_settings.expressions.custom].filter(onlyUnique);
    }

    /**
     * Returns the list of expressions from the API or fallback in offline mode.
     * @returns {Promise<string[]>}
     */
    async function resolveExpressionsList() {
        // See if we can retrieve a specific expression list from the API
        try {
            // Check Extras api first, if enabled and that module active
            if (extension_settings.expressions.api == EXPRESSION_API.extras && modules.includes('classify')) {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify/labels';

                const apiResult = await doExtrasFetch(url, {
                    method: 'GET',
                    headers: { 'Bypass-Tunnel-Reminder': 'bypass' },
                });

                if (apiResult.ok) {

                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }

            // If running the local classify model (not using the LLM), we ask that one
            if (extension_settings.expressions.api == EXPRESSION_API.local) {
                const apiResult = await fetch('/api/extra/classify/labels', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                });

                if (apiResult.ok) {
                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }
        } catch (error) {
            console.log(error);
        }

        // If there was no specific list, or an error, just return the default expressions
        return CLASSIFY_EXPRESSIONS;
    }

    const result = await resolveExpressionsList();
    return [...result, ...extension_settings.expressions.custom].filter(onlyUnique);
}

/**
 * Gets the classification prompt for the LLM API.
 * @param {string[]} labels A list of labels to search for.
 * @returns {Promise<string>} Prompt for the LLM API.
 */
async function getLlmPrompt(labels) {
    if (isJsonSchemaSupported()) {
        return '';
    }

    const labelsString = labels.map(x => `"${x}"`).join(', ');
    const prompt = substituteParams(String(extension_settings.expressions.llmPrompt))
        .replace(/{{labels}}/gi, labelsString);
    return prompt;
}

function onTextGenSettingsReady(args) {
    // Only call if inside an API call
    if (inApiCall && extension_settings.expressions.api === EXPRESSION_API.llm && isJsonSchemaSupported()) {
        const emotions = DEFAULT_EXPRESSIONS.filter((e) => e != 'talkinghead');
        Object.assign(args, {
            top_k: 1,
            stop: [],
            stopping_strings: [],
            custom_token_bans: [],
            json_schema: {
                $schema: 'http://json-schema.org/draft-04/schema#',
                type: 'object',
                properties: {
                    emotion: {
                        type: 'string',
                        enum: emotions,
                    },
                },
                required: [
                    'emotion',
                ],
            },
        });
    }
}

async function getExpressionLabel(text) {
    
    // Return if text is undefined, saving a costly fetch request
    //if ((!modules.includes('classify') && !extension_settings.expressions.local) || !text) {
    if ((!modules.includes('classify') && extension_settings.expressions.api == EXPRESSION_API.extras) || !text) {
        return FALLBACK_EXPRESSION;
    }

    try {
        if (extension_settings.expressions.translate && typeof window['translate'] === 'function') {
            text = await window['translate'](text, 'en');
        }
    } catch (translateError) {
        console.warn(DEBUG_PREFIX, 'Translation failed:', translateError);
    }

    text = sampleClassifyText(text);

    try {
        switch (extension_settings.expressions.api) {
            // Local BERT pipeline
            case EXPRESSION_API.local: {
                const localResult = await fetch('/api/extra/classify', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ text: text }),
                });

                if (localResult.ok) {
                    const data = await localResult.json();
                    return data.classification[0].label;
                }
            } break;
            // Using LLM
            case EXPRESSION_API.llm: {
                const expressionsList = await getExpressionsList();
                const prompt = await getLlmPrompt(expressionsList);
                eventSource.once(event_types.TEXT_COMPLETION_SETTINGS_READY, onTextGenSettingsReady);
                const emotionResponse = await generateQuietPrompt(prompt, false, false);
                return parseLlmResponse(emotionResponse, expressionsList);
            }
            // Extras
            default: {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify';

                const extrasResult = await doExtrasFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'bypass',
                    },
                    body: JSON.stringify({ text: text }),
                });

                if (extrasResult.ok) {
                    const data = await extrasResult.json();
                    return data.classification[0].label;
                }
            } break;
        }
    } catch (error) {
        toastr.info('Could not classify expression. Check the console or your backend for more information.');
        console.error(error);
        return FALLBACK_EXPRESSION;
    }
}

/**
 * Parses the emotion response from the LLM API.
 * @param {string} emotionResponse The response from the LLM API.
 * @param {string[]} labels A list of labels to search for.
 * @returns {string} The parsed emotion or the fallback expression.
 */
function parseLlmResponse(emotionResponse, labels) {
    const fallbackExpression = FALLBACK_EXPRESSION;

    try {
        const parsedEmotion = JSON.parse(emotionResponse);
        return parsedEmotion?.emotion ?? fallbackExpression;
    } catch {
        const fuse = new Fuse([emotionResponse], { threshold: 0.3 });
        for (const label of labels) {
            const result = fuse.search(label);
            if (result.length > 0) {
                return label;
            }
        }
    }

    throw new Error('Could not parse emotion response ' + emotionResponse);
}

/**
 * Processes the classification text to reduce the amount of text sent to the API.
 * Quotes and asterisks are to be removed. If the text is less than 300 characters, it is returned as is.
 * If the text is more than 300 characters, the first and last 150 characters are returned.
 * The result is trimmed to the end of sentence.
 * @param {string} text The text to process.
 * @returns {string}
 */
function sampleClassifyText(text) {
    if (!text) {
        return text;
    }

    // Remove asterisks and quotes
    let result = text.replace(/[\*\"]/g, '');

    const SAMPLE_THRESHOLD = 300;
    const HALF_SAMPLE_THRESHOLD = SAMPLE_THRESHOLD / 2;

    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, HALF_SAMPLE_THRESHOLD)) + ' ' + trimToStartSentence(result.slice(-HALF_SAMPLE_THRESHOLD));
    }

    return result.trim();
}