import { getContext } from '../../../../../../extensions.js';
import { state } from './state.js';
import { getRequestHeaders } from '../../../../../../../script.js';
import { PresetManager } from './preset-manager.js';

const LOG_PREFIX = '[ProsePolisher:API]';

// Initialize preset manager
const presetManager = new PresetManager();
presetManager.initialize();

/**
 * Executes a generation request with the given prompt text.
 * @param {string} promptText - The text to be used for the generation.
 * @returns {Promise<string>} The generated text.
 */
export async function executeGen(promptText) {
    if (!state.isAppReady) {
        console.warn(`${LOG_PREFIX} executeGen called before app ready.`);
        throw new Error("SillyTavern not ready to execute generation.");
    }
    const context = getContext();

    // Clean and properly escape the prompt text for JSON stringification
    let cleanPromptText = promptText;
    try {
        // Pre-clean any problematic characters that might cause JSON.stringify to fail
        // Normalize line endings first
        cleanPromptText = promptText
            .replace(/\r\n/g, '\n')       // Normalize line endings
            .replace(/\r/g, '\n');        // Convert remaining \r to \n
            
        const script = `/gen ${JSON.stringify(cleanPromptText)} |`;

        console.log(`${LOG_PREFIX} Executing generation: /gen "..." |`);
        const result = await context.executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        if (result && result.isError) {
            throw new Error(`STScript execution failed during /gen: ${result.errorMessage}`);
        }
        return result.pipe || '';
    } catch (error) {
        // If JSON.stringify or execution fails, try a more aggressive cleaning approach
        console.warn(`${LOG_PREFIX} Primary generation attempt failed, trying with more aggressive text cleaning...`);
        try {
            // More aggressive cleaning for problematic prompts
            cleanPromptText = promptText
                .replace(/["'`\\]/g, ' ')    // Replace all quotes, backticks, and backslashes with spaces
                .replace(/\s+/g, ' ')       // Collapse multiple spaces
                .trim();
                
            const fallbackScript = `/gen ${JSON.stringify(cleanPromptText)} |`;
            const result = await context.executeSlashCommandsWithOptions(fallbackScript, {
                showOutput: false,
                handleExecutionErrors: true,
            });
            if (result && result.isError) {
                throw new Error(`STScript execution failed during /gen fallback: ${result.errorMessage}`);
            }
            return result.pipe || '';
        } catch (fallbackError) {
            console.error(`${LOG_PREFIX} Error executing generation script: "${promptText.substring(0, 100)}..."`, fallbackError);
            window.toastr.error(`Prose Polisher failed during generation. Error: ${fallbackError.message}`, "Generation Failed");
            throw fallbackError;
        }
    }
}

/**
 * Executes a generation without macro processing using direct API calls.
 * This bypasses SillyTavern's macro substitution system completely.
 * Uses Card Emporium preset for consistent high-quality results.
 * @param {string} promptText - The raw prompt text (no macro substitution)
 * @returns {Promise<string>} The generated text
 */
export async function executeGenRaw(promptText) {
    if (!promptText?.trim()) {
        throw new Error('No prompt provided for raw generation.');
    }

    if (!state.isAppReady) {
        console.warn(`${LOG_PREFIX} executeGenRaw called before app ready.`);
        throw new Error('SillyTavern not ready for raw generation.');
    }

    // Wrap generation with preset switching for consistent results
    return await presetManager.executeWithPresetSwitch(async () => {
        try {
            console.log(`${LOG_PREFIX} Executing raw generation without macro processing...`);

            // Get current API settings from SillyTavern
            const context = getContext();
            const currentApi = context.main_api;

            let result;

            if (currentApi === 'openai') {
                // Use chat completion for OpenAI-compatible APIs
                result = await executeRawChatCompletion(promptText);
            } else {
                // Use text completion for other APIs
                result = await executeRawTextCompletion(promptText);
            }

            return result || '';

        } catch (error) {
            console.error(`${LOG_PREFIX} Raw generation failed:`, error);
            // Fallback to regular generation if raw fails
            console.log(`${LOG_PREFIX} Falling back to regular generation...`);
            return await executeGen(promptText);
        }
    });
}

/**
 * Direct chat completion call bypassing macro processing
 * @param {string} promptText - Raw prompt text
 * @returns {Promise<string>} Generated text
 */
async function executeRawChatCompletion(promptText) {
    const context = getContext();

    // Get current chat completion source and model
    const source = context.chat_completion_source || 'openai';
    const model = context.selected_model || 'gpt-3.5-turbo';

    const payload = {
        messages: [
            {
                role: 'user',
                content: promptText // Raw content - no macro processing
            }
        ],
        model: model,
        max_tokens: 200,
        temperature: 0.7,
        chat_completion_source: source
    };

    console.log(`${LOG_PREFIX} Making direct chat completion call to ${source}...`);

    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Chat completion request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Chat completion error: ${data.error}`);
    }

    // Extract content from response based on different response formats
    return data.choices?.[0]?.message?.content ||
           data.content ||
           data.results?.[0]?.text ||
           '';
}

/**
 * Direct text completion call bypassing macro processing
 * @param {string} promptText - Raw prompt text
 * @returns {Promise<string>} Generated text
 */
async function executeRawTextCompletion(promptText) {
    const context = getContext();

    // Get current API settings
    const apiType = context.main_api || 'textgenerationwebui';

    const payload = {
        prompt: promptText, // Raw prompt - no macro processing
        max_tokens: 200,
        temperature: 0.7,
        api_type: apiType
    };

    console.log(`${LOG_PREFIX} Making direct text completion call to ${apiType}...`);

    const response = await fetch('/api/backends/text-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Text completion request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Text completion error: ${data.error}`);
    }

    // Extract content from response
    return data.results?.[0]?.text ||
           data.content ||
           data.text ||
           '';
}