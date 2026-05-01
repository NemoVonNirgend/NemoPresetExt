/**
 * Pollinations Interceptor
 *
 * Experimental feature that intercepts Pollinations.ai image URLs in messages,
 * extracts the prompts, and regenerates them using SillyTavern's configured
 * image generation backend.
 *
 * @module pollinations-interceptor
 */

import logger from '../core/logger.js';
import {
    DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES,
    DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES,
    NEMO_EXTENSION_NAME,
    POLLINATIONS_IMAGE_STYLE_PRESETS
} from '../core/utils.js';
import { getRequestHeaders, eventSource, event_types, chat, saveChatDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { saveBase64AsFile } from '../../../../utils.js';

const LOG_PREFIX = '[Pollinations Interceptor]';

// Regex to match Pollinations image URLs
const POLLINATIONS_URL_REGEX = /https?:\/\/image\.pollinations\.ai\/prompt\/([^?]+)(\?[^"'\s>]*)?/gi;

// Track which images are being processed to avoid duplicates
const processingImages = new Set();

// Queue for automatic processing
const imageQueue = [];
const MAX_PARALLEL_GENERATIONS = 4;
const SERIAL_IMAGE_GENERATION_SOURCES = new Set(['openai', 'horde']);
const MAX_GENERATION_ATTEMPTS = 3;
const SOURCE_GENERATION_ATTEMPTS = {
    novel: 2
};
const GENERATION_RETRY_DELAY_MS = 1500;
const SAVED_IMAGE_SUBFOLDER_FALLBACK = 'NemoPresetExt';
const STREAMING_IMAGE_READY_CHECK_DELAY_MS = 350;
const STREAMING_IMAGE_MAX_WAIT_MS = 12000;
let activeQueueProcesses = 0;

// Timers for images detected while a message is still streaming.
const pendingStreamingImageTimers = new WeakMap();

// MutationObserver for real-time streaming detection
let streamingObserver = null;

// Common boilerplate terms to strip from Pollinations prompts
// These are quality/style tags that are model-specific and should be replaced with user's own settings
const BOILERPLATE_TERMS = [
    // Quality tags
    'masterpiece', 'best quality', 'high quality', 'highest quality',
    'amazing quality', 'very aesthetic', 'absurdres', 'highres',
    'ultra detailed', 'extremely detailed', 'intricate details',
    '8k', '4k', 'hd', 'uhd',
    // Style tags that are too generic
    'manga style', 'anime style', 'comic style',
    'monochrome', 'greyscale', 'grayscale', 'black and white',
    'screentones', 'halftone', 'ink drawing', 'lineart',
    'high contrast', 'detailed background',
    // Negative prompt boilerplate
    'worst quality', 'low quality', 'blurry', 'deformed',
    'bad anatomy', 'bad hands', 'missing fingers', 'extra digits',
    'fewer digits', 'cropped', 'watermark', 'signature',
    'jpeg artifacts', 'username', 'error'
];

/**
 * Strip boilerplate terms from a prompt to extract the unique content
 * @param {string} prompt - The original prompt
 * @returns {string} Cleaned prompt with only unique descriptive content
 */
function stripBoilerplate(prompt) {
    let cleaned = prompt.toLowerCase();

    // Remove boilerplate terms (case insensitive)
    for (const term of BOILERPLATE_TERMS) {
        // Match the term with optional surrounding commas/spaces
        const regex = new RegExp(`\\b${term}\\b[,\\s]*|[,\\s]*\\b${term}\\b`, 'gi');
        cleaned = cleaned.replace(regex, ' ');
    }

    // Clean up multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove leading/trailing commas
    cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/g, '').trim();

    return cleaned;
}

/**
 * Get the user's configured prompt prefix/suffix from ST settings
 * @returns {Object} Object with prefix and suffix strings
 */
function getUserPromptSettings() {
    const prefix = extension_settings.sd?.prompt_prefix || '';
    const suffix = extension_settings.sd?.prompt_suffix || '';
    const negativePrompt = extension_settings.sd?.negative_prompt || '';

    return { prefix, suffix, negativePrompt };
}

/**
 * Join prompt fragments without introducing empty comma slots.
 * @param {...string} parts - Prompt fragments
 * @returns {string} Combined prompt
 */
function joinPromptParts(...parts) {
    return parts
        .map(part => (part || '').trim())
        .filter(Boolean)
        .join(', ');
}

/**
 * Wait for a duration.
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the current SillyTavern image generation source.
 * @returns {string} Configured source
 */
function getImageGenerationSource() {
    return extension_settings.sd?.source || 'pollinations';
}

/**
 * Get queue concurrency for the active image backend.
 * @returns {number} Maximum active generations
 */
function getMaxParallelGenerations() {
    const source = getImageGenerationSource();
    return SERIAL_IMAGE_GENERATION_SOURCES.has(source) ? 1 : MAX_PARALLEL_GENERATIONS;
}

/**
 * Get max generation attempts for the active backend.
 * @returns {number} Attempt count
 */
function getMaxGenerationAttempts() {
    const source = getImageGenerationSource();
    return SOURCE_GENERATION_ATTEMPTS[source] || MAX_GENERATION_ATTEMPTS;
}

/**
 * Check whether an image generation error is worth retrying.
 * @param {Error & {status?: number}} error - Generation error
 * @returns {boolean} True if retryable
 */
function isRetryableGenerationError(error) {
    return !error.status || [429, 500, 502, 503, 504].includes(error.status);
}

/**
 * Get NovelAI-safe dimensions and steps using the same Anlas guard as SillyTavern's SD extension.
 * @returns {{steps: number, width: number, height: number}} NovelAI generation dimensions and steps
 */
function getNovelGenerationParams() {
    let steps = Math.min(extension_settings.sd?.steps || 28, 50);
    let width = extension_settings.sd?.width || 512;
    let height = extension_settings.sd?.height || 512;

    if (!extension_settings.sd?.novel_anlas_guard) {
        return { steps, width, height };
    }

    const maxSteps = 28;
    const maxPixels = 1024 * 1024;

    if (width * height > maxPixels) {
        const ratio = Math.sqrt(maxPixels / (width * height));
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        if (width % 64 !== 0) {
            width -= width % 64;
        }

        if (height % 64 !== 0) {
            height -= height % 64;
        }

        while (width * height > maxPixels) {
            if (width > height) {
                width -= 64;
            } else {
                height -= 64;
            }
        }
    }

    if (steps > maxSteps) {
        steps = maxSteps;
    }

    return { steps, width, height };
}

/**
 * Get Nemo's optional image prompt consistency guidance.
 * @returns {Object} Positive and negative prompt best-practice strings
 */
function getPromptBestPractices() {
    const nemoSettings = extension_settings[NEMO_EXTENSION_NAME] || {};

    if (nemoSettings.nemoPollinationsPromptBestPractices === false) {
        return { positive: '', negative: '' };
    }

    return {
        positive: nemoSettings.nemoPollinationsBestPracticesPrompt || DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES,
        negative: nemoSettings.nemoPollinationsNegativeBestPracticesPrompt || DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES
    };
}

/**
 * Get the currently selected image style preset.
 * @returns {Object} Positive and negative style prompt strings
 */
function getImageStylePreset() {
    const nemoSettings = extension_settings[NEMO_EXTENSION_NAME] || {};
    const selectedStyle = nemoSettings.nemoPollinationsStylePreset || 'none';
    const preset = POLLINATIONS_IMAGE_STYLE_PRESETS.find(style => style.id === selectedStyle);

    return preset || POLLINATIONS_IMAGE_STYLE_PRESETS[0];
}

/**
 * Parse a Pollinations URL to extract prompt and parameters
 * @param {string} url - The full Pollinations URL
 * @returns {Object} Parsed data with prompt, width, height, model, negative_prompt, seed
 */
export function parsePollinationsUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/prompt/');

        if (pathParts.length < 2) {
            return null;
        }

        // Decode the URL-encoded prompt
        const encodedPrompt = pathParts[1];
        const prompt = decodeURIComponent(encodedPrompt.replace(/%20/g, ' '));

        // Extract query parameters
        const params = urlObj.searchParams;

        return {
            prompt: prompt,
            width: parseInt(params.get('width')) || 512,
            height: parseInt(params.get('height')) || 512,
            model: params.get('model') || 'flux',
            negative_prompt: params.get('negative_prompt') ? decodeURIComponent(params.get('negative_prompt')) : '',
            seed: params.get('seed') ? parseInt(params.get('seed')) : -1,
            nologo: params.get('nologo') === 'true'
        };
    } catch (error) {
        logger.error(`${LOG_PREFIX} Error parsing URL:`, error);
        return null;
    }
}

/**
 * Generate an image using SillyTavern's configured image generation backend
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - The image prompt
 * @param {string} params.negative_prompt - Negative prompt
 * @param {number} params.width - Image width
 * @param {number} params.height - Image height
 * @param {number} params.seed - Seed for reproducibility (-1 for random)
 * @returns {Promise<string|null>} Base64 image data or null on failure
 */
async function generateImageWithST(params) {
    const { prompt: rawPrompt, negative_prompt: rawNegative, width, height, seed } = params;

    // Get the current SD source from extension settings
    const source = getImageGenerationSource();

    // Strip boilerplate from the prompt to get just the unique scene description
    const strippedPrompt = stripBoilerplate(rawPrompt);

    // Get user's configured prompt settings
    const userSettings = getUserPromptSettings();
    const bestPractices = getPromptBestPractices();
    const stylePreset = getImageStylePreset();

    // Build the final prompt: user prefix + selected style + consistency guidance + stripped content + user suffix
    const finalPrompt = joinPromptParts(
        userSettings.prefix,
        stylePreset.prompt,
        bestPractices.positive,
        strippedPrompt,
        userSettings.suffix
    );

    // Preserve user negative prompt, then add style cleanup, consistency cleanup, and the stripped Pollinations negative.
    const finalNegative = joinPromptParts(
        userSettings.negativePrompt,
        stylePreset.negative,
        bestPractices.negative,
        stripBoilerplate(rawNegative)
    );

    console.log(`${LOG_PREFIX} Generating image with source: ${source}`);
    console.log(`${LOG_PREFIX} Original prompt: ${rawPrompt.substring(0, 80)}...`);
    console.log(`${LOG_PREFIX} Stripped prompt: ${strippedPrompt.substring(0, 80)}...`);
    console.log(`${LOG_PREFIX} Final prompt: ${finalPrompt.substring(0, 80)}...`);
    console.log(`${LOG_PREFIX} Final negative: ${finalNegative.substring(0, 80)}...`);

    // Build the API endpoint based on source
    let endpoint;
    let body;

    switch (source) {
        case 'pollinations':
            endpoint = '/api/sd/pollinations/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                model: extension_settings.sd?.model || 'flux',
                width,
                height,
                enhance: extension_settings.sd?.pollinations_enhance || false,
                seed: seed >= 0 ? seed : undefined
            };
            break;

        case 'auto':
        case 'vlad':
            endpoint = '/api/sd/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                sampler_name: extension_settings.sd?.sampler,
                steps: extension_settings.sd?.steps || 20,
                cfg_scale: extension_settings.sd?.scale || 7,
                width,
                height,
                seed: -1, // Always random - Pollinations seeds don't translate
                n_iter: 1,
                batch_size: 1,
                restore_faces: extension_settings.sd?.restore_faces || false,
                enable_hr: extension_settings.sd?.enable_hr || false
            };
            break;

        case 'novel':
            endpoint = '/api/novelai/generate-image';
            // Get NAI-specific settings
            const naiParams = getNovelGenerationParams();
            let naiSm = extension_settings.sd?.novel_sm || false;
            let naiSmDyn = extension_settings.sd?.novel_sm_dyn || false;
            // Disable sm/sm_dyn for certain models/samplers
            if (extension_settings.sd?.sampler === 'ddim' ||
                ['nai-diffusion-4-curated-preview', 'nai-diffusion-4-full'].includes(extension_settings.sd?.model)) {
                naiSm = false;
                naiSmDyn = false;
            }
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                model: extension_settings.sd?.model,
                sampler: extension_settings.sd?.sampler,
                scheduler: extension_settings.sd?.scheduler || 'karras',
                steps: naiParams.steps,
                scale: extension_settings.sd?.scale || 7,
                width: naiParams.width,
                height: naiParams.height,
                upscale_ratio: extension_settings.sd?.hr_scale || 1,
                decrisper: extension_settings.sd?.novel_decrisper || false,
                variety_boost: extension_settings.sd?.novel_variety_boost || false,
                sm: naiSm,
                sm_dyn: naiSmDyn,
                seed: extension_settings.sd?.seed >= 0 ? extension_settings.sd.seed : undefined
            };
            break;

        case 'openai':
            endpoint = '/api/openai/generate-image';
            body = {
                prompt: finalPrompt,
                size: `${width}x${height}`,
                model: extension_settings.sd?.model || 'dall-e-3',
                quality: extension_settings.sd?.openai_quality || 'standard',
                style: extension_settings.sd?.openai_style || 'vivid'
            };
            break;

        case 'comfy':
            endpoint = '/api/sd/comfy/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                width,
                height
                // No seed - Pollinations seeds don't translate
            };
            break;

        case 'togetherai':
            endpoint = '/api/sd/together/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                model: extension_settings.sd?.model,
                width,
                height,
                steps: extension_settings.sd?.steps || 20
                // No seed - Pollinations seeds don't translate
            };
            break;

        case 'stability':
            endpoint = '/api/sd/stability/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                model: extension_settings.sd?.model,
                width,
                height
                // No seed - Pollinations seeds don't translate
            };
            break;

        case 'horde':
            endpoint = '/api/horde/generate-image';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                sampler: extension_settings.sd?.sampler,
                steps: extension_settings.sd?.steps || 30,
                cfg_scale: extension_settings.sd?.scale || 7,
                width,
                height,
                karras: extension_settings.sd?.horde_karras || false,
                model: extension_settings.sd?.model
                // No seed - Pollinations seeds don't translate
            };
            break;

        default:
            // Fallback to Pollinations - here we CAN use the seed since it's the same backend
            endpoint = '/api/sd/pollinations/generate';
            body = {
                prompt: finalPrompt,
                negative_prompt: finalNegative,
                model: 'flux',
                width,
                height,
                seed: seed >= 0 ? seed : undefined // Keep seed for Pollinations fallback
            };
    }

    let lastError = null;
    const maxAttempts = getMaxGenerationAttempts();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await requestGeneratedImage(endpoint, body);
        } catch (error) {
            lastError = error;

            if (attempt < maxAttempts && isRetryableGenerationError(error)) {
                logger.warn(`${LOG_PREFIX} Image generation failed; retrying (${attempt}/${maxAttempts})`, error);
                await wait(GENERATION_RETRY_DELAY_MS * attempt);
                continue;
            }

            break;
        }
    }

    logger.error(`${LOG_PREFIX} Image generation failed:`, lastError);
    return null;
}

/**
 * Send an image generation request and parse the response.
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<string|null>} Base64 image data
 */
async function requestGeneratedImage(endpoint, body) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`API error: ${response.status} - ${errorText}`);
        error.status = response.status;
        throw error;
    }

    // Get the response as text first to check what format it is
    const responseText = await response.text();

    // Check if it's raw base64 (starts with base64 PNG/JPEG header characters)
    // PNG base64 starts with "iVBOR", JPEG with "/9j/"
    if (responseText.startsWith('iVBOR') || responseText.startsWith('/9j/')) {
        console.log(`${LOG_PREFIX} Received raw base64 response`);
        return responseText;
    }

    // Try to parse as JSON
    try {
        const data = JSON.parse(responseText);

        // Different sources return data in different formats
        if (data.image) {
            return data.image; // Base64 string
        } else if (data.images && data.images.length > 0) {
            return data.images[0]; // Array of base64 strings
        } else if (data.data) {
            return data.data;
        }

        // If we got JSON but no recognizable image field, log it
        console.log(`${LOG_PREFIX} JSON response structure:`, Object.keys(data));
        return null;
    } catch (parseError) {
        // Not JSON, might be raw base64 with different header
        // Check if it looks like base64 (only valid base64 characters)
        if (/^[A-Za-z0-9+/=]+$/.test(responseText.substring(0, 100))) {
            console.log(`${LOG_PREFIX} Response appears to be base64`);
            return responseText;
        }
        throw new Error(`Unexpected response format: ${responseText.substring(0, 50)}...`);
    }
}

/**
 * Get the message ID from an image element by traversing up to find the .mes container
 * @param {HTMLImageElement} imgElement - The image element
 * @returns {number|null} The message ID or null if not found
 */
function getMessageIdFromImage(imgElement) {
    const mesBlock = imgElement.closest('.mes');
    if (mesBlock && mesBlock.hasAttribute('mesid')) {
        const messageId = parseInt(mesBlock.getAttribute('mesid'), 10);
        return Number.isFinite(messageId) ? messageId : null;
    }
    return null;
}

/**
 * Update the message content in the chat array, replacing a source image URL with a saved image URL
 * @param {number} messageId - The message index in the chat array
 * @param {string|string[]} sourceUrls - Candidate image URLs to replace
 * @param {string} imageUrl - The saved image URL to replace with
 * @returns {boolean} True if successful
 */
function updateMessageContent(messageId, sourceUrls, imageUrl) {
    try {
        if (!chat || messageId < 0 || messageId >= chat.length) {
            console.warn(`${LOG_PREFIX} Invalid message ID: ${messageId}`);
            return false;
        }

        const message = chat[messageId];
        if (!message || !message.mes) {
            console.warn(`${LOG_PREFIX} Message not found or has no content`);
            return false;
        }

        const originalContent = message.mes;
        const candidates = getUrlReplacementCandidates(sourceUrls);

        for (const sourceUrl of candidates) {
            // Replace one matching image URL. This lets repeated URLs process as separate images.
            const escapedUrl = sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const urlRegex = new RegExp(escapedUrl);
            message.mes = message.mes.replace(urlRegex, imageUrl);

            if (message.mes !== originalContent) {
                console.log(`${LOG_PREFIX} Updated message ${messageId} content - replaced image URL`);

                // Save the chat to persist the change
                saveChatDebounced();

                return true;
            }
        }

        console.warn(`${LOG_PREFIX} Image URL not found in message content`);
        return false;
    } catch (error) {
        console.error(`${LOG_PREFIX} Error updating message content:`, error);
        return false;
    }
}

/**
 * Build candidate URL strings for replacing rendered image sources back in message text.
 * @param {string|string[]} sourceUrls - Source URL or URLs
 * @returns {string[]} Unique replacement candidates
 */
function getUrlReplacementCandidates(sourceUrls) {
    const urls = Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls];
    const candidates = new Set();

    for (const url of urls) {
        if (!url) {
            continue;
        }

        const sourceUrl = String(url);
        candidates.add(sourceUrl);
        candidates.add(sourceUrl.replace(/&/g, '&amp;'));

        try {
            candidates.add(decodeURI(sourceUrl));
        } catch {
            // Keep the original candidate if it is not a valid encoded URI.
        }
    }

    return Array.from(candidates).filter(Boolean);
}

/**
 * Build a filesystem-safe-ish generated image filename.
 * @param {number|null} messageId - Chat message index
 * @returns {string} Filename without extension
 */
function getGeneratedImageFileName(messageId) {
    const messagePart = messageId !== null ? `mes-${messageId}` : 'manual';
    return `nemo-pollinations-${messagePart}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get the gallery subfolder for a generated image.
 * @param {number|null} messageId - Chat message index
 * @returns {string} Gallery subfolder name
 */
function getGeneratedImageSubfolder(messageId) {
    if (chat && messageId !== null && messageId >= 0 && messageId < chat.length) {
        const messageName = chat[messageId]?.name;
        if (messageName) {
            return messageName;
        }
    }

    return SAVED_IMAGE_SUBFOLDER_FALLBACK;
}

/**
 * Encode a saved image path so it is safe in markdown image URLs.
 * @param {string} imagePath - Client-relative image path
 * @returns {string} URL-encoded image path
 */
function encodeSavedImagePath(imagePath) {
    return String(imagePath)
        .split('/')
        .map(segment => encodeURIComponent(segment).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
        .join('/');
}

/**
 * Save generated base64 image data through SillyTavern's image upload endpoint.
 * @param {string} base64Image - Base64 image data
 * @param {number|null} messageId - Chat message index
 * @returns {Promise<string|null>} Saved image URL or null
 */
async function saveGeneratedImageFile(base64Image, messageId) {
    try {
        const savedImagePath = await saveBase64AsFile(
            base64Image,
            getGeneratedImageSubfolder(messageId),
            getGeneratedImageFileName(messageId),
            'png'
        );
        return encodeSavedImagePath(savedImagePath);
    } catch (error) {
        logger.error(`${LOG_PREFIX} Failed to save generated image file:`, error);
        return null;
    }
}

/**
 * Add an image to the processing queue
 * @param {HTMLImageElement} imgElement - The image element to queue
 */
function queueImage(imgElement) {
    // Check if already in queue
    if (imageQueue.some(item => item.element === imgElement)) {
        return;
    }

    clearPendingStreamingImage(imgElement);

    imageQueue.push({ element: imgElement });
    processQueue();
}

/**
 * Check if an image is queued or actively processing.
 * @param {HTMLImageElement} imgElement - The image element to check
 * @returns {boolean} True if queued or processing
 */
function isImageQueuedOrProcessing(imgElement) {
    const processingKey = imgElement.dataset.nemoImageId || imgElement.dataset.originalPollinationsUrl || imgElement.src;
    return imageQueue.some(item => item.element === imgElement) || processingImages.has(processingKey);
}

/**
 * Process the image queue with bounded concurrency.
 * Manga panel responses commonly include 4 images, so allow those to launch together.
 */
function processQueue() {
    const maxParallelGenerations = getMaxParallelGenerations();
    while (activeQueueProcesses < maxParallelGenerations && imageQueue.length > 0) {
        const { element } = imageQueue.shift();

        // Skip if element was removed from DOM
        if (!document.contains(element)) {
            continue;
        }

        activeQueueProcesses++;
        processPollinationsImage(element)
            .catch(error => {
                logger.error(`${LOG_PREFIX} Queued image processing failed:`, error);
            })
            .finally(() => {
                activeQueueProcesses--;
                processQueue();
            });
    }
}

/**
 * Process a single image element with a Pollinations URL
 * @param {HTMLImageElement} imgElement - The image element to process
 */
async function processPollinationsImage(imgElement) {
    // Get the original URL - either from data attribute (for regeneration) or current src
    const originalSrc = imgElement.dataset.originalPollinationsUrl || imgElement.src;

    // Skip if this is already a data URL (already replaced)
    if (originalSrc.startsWith('data:')) {
        console.log(`${LOG_PREFIX} Skipping - already a data URL`);
        return;
    }

    // Create a unique key for this specific image element
    const processingKey = imgElement.dataset.nemoImageId || originalSrc;

    // Skip if already processing this specific element
    if (processingImages.has(processingKey)) {
        return;
    }

    // Parse the URL (use stored data if available, otherwise parse current src)
    let parsed;
    if (imgElement.dataset.pollinationsData) {
        parsed = JSON.parse(imgElement.dataset.pollinationsData);
    } else {
        parsed = parsePollinationsUrl(originalSrc);
        if (!parsed) {
            console.warn(`${LOG_PREFIX} Could not parse URL:`, originalSrc);
            return;
        }
        // Store for future regeneration
        imgElement.dataset.pollinationsData = JSON.stringify(parsed);
        imgElement.dataset.originalPollinationsUrl = originalSrc;
    }

    console.log(`${LOG_PREFIX} Processing Pollinations image:`, parsed.prompt.substring(0, 50) + '...');

    // Mark as processing
    processingImages.add(processingKey);

    // Add visual indicator
    imgElement.style.opacity = '0.5';
    imgElement.style.filter = 'blur(2px)';
    imgElement.title = 'Regenerating with SillyTavern...';

    // Add a loading overlay
    const wrapper = imgElement.parentElement;
    let loadingOverlay = null;
    if (wrapper) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'nemo-pollinations-loading';
        loadingOverlay.innerHTML = `
            <div class="nemo-pollinations-loading-content">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Generating...</span>
            </div>
        `;
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.5);
            color: white;
            font-size: 14px;
            z-index: 10;
        `;
        wrapper.style.position = 'relative';
        wrapper.appendChild(loadingOverlay);
    }

    try {
        // Generate the image
        const base64Image = await generateImageWithST(parsed);

        if (base64Image) {
            const messageId = getMessageIdFromImage(imgElement);
            const previousImageUrl = imgElement.dataset.generatedImageUrl || imgElement.getAttribute('src') || originalSrc;
            const savedImageUrl = await saveGeneratedImageFile(base64Image, messageId);

            // Replace the image source in DOM. Prefer the saved URL so refreshes reuse the file.
            imgElement.src = savedImageUrl || `data:image/png;base64,${base64Image}`;
            imgElement.style.opacity = '1';
            imgElement.style.filter = 'none';
            imgElement.title = savedImageUrl
                ? 'Generated by SillyTavern and saved (click to regenerate)'
                : 'Generated by SillyTavern for this session (click to regenerate)';

            // Store original URL as data attribute for reference
            imgElement.dataset.originalPollinationsUrl = originalSrc;
            imgElement.dataset.generatedPrompt = parsed.prompt;
            if (savedImageUrl) {
                imgElement.dataset.generatedImageUrl = savedImageUrl;
            }

            // Update the message content to persist the saved image URL, never inline base64.
            if (messageId !== null && savedImageUrl) {
                const updated = updateMessageContent(messageId, [previousImageUrl, originalSrc], savedImageUrl);
                if (updated) {
                    console.log(`${LOG_PREFIX} Successfully replaced and persisted saved image URL`);
                } else {
                    console.log(`${LOG_PREFIX} Replaced image in DOM but could not persist saved URL to message`);
                }
            } else if (messageId !== null) {
                console.log(`${LOG_PREFIX} Replaced image in DOM only; generated image file could not be saved`);
            } else {
                console.warn(`${LOG_PREFIX} Could not find message ID for image`);
            }
        } else {
            // Failed - restore original
            imgElement.style.opacity = '1';
            imgElement.style.filter = 'none';
            imgElement.title = 'Failed to regenerate - using Pollinations';
            console.warn(`${LOG_PREFIX} Failed to generate image, keeping original`);
        }
    } catch (error) {
        logger.error(`${LOG_PREFIX} Error processing image:`, error);
        imgElement.style.opacity = '1';
        imgElement.style.filter = 'none';
        imgElement.title = 'Error - using Pollinations';
    } finally {
        // Remove loading overlay
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
        // Remove from processing set
        processingImages.delete(processingKey);
    }
}

/**
 * Scan a message element for Pollinations images, auto-queue them, and add click-to-regenerate
 * @param {HTMLElement} messageElement - The message element to scan
 * @param {boolean} autoQueue - Whether to automatically queue found images for regeneration
 */
export function scanMessageForPollinationsImages(messageElement, autoQueue = true) {
    if (!messageElement) return;

    const images = messageElement.querySelectorAll('img[src*="image.pollinations.ai"]');

    images.forEach(img => {
        // Skip if already set up
        if (img.dataset.nemoIntercepted) {
            if (autoQueue && !isImageQueuedOrProcessing(img)) {
                queueImage(img);
            }
            return;
        }

        // Generate unique ID for this image element
        img.dataset.nemoImageId = `nemo-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        img.dataset.nemoIntercepted = 'true';

        // Set up click-to-regenerate on the image itself
        setupClickToRegenerate(img);

        // Auto-queue for processing
        if (autoQueue) {
            queueImage(img);
        }
    });

    return images.length;
}

/**
 * Set up click-to-regenerate handler on an image
 * Works on both Pollinations images and already-replaced images
 * @param {HTMLImageElement} img - The image element
 */
function setupClickToRegenerate(img) {
    // Add cursor style to indicate clickable
    img.style.cursor = 'pointer';

    // Create regenerate overlay that shows on hover
    const wrapper = img.parentElement;
    if (wrapper && !wrapper.querySelector('.nemo-regen-overlay')) {
        wrapper.style.position = 'relative';

        const overlay = document.createElement('div');
        overlay.className = 'nemo-regen-overlay';
        overlay.innerHTML = '<i class="fa-solid fa-rotate"></i> Click to regenerate';
        overlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            color: white;
            padding: 20px 8px 8px 8px;
            font-size: 12px;
            text-align: center;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
            z-index: 5;
        `;
        wrapper.appendChild(overlay);

        // Show overlay on hover
        wrapper.addEventListener('mouseenter', () => {
            // Don't show if currently processing
            if (!processingImages.has(img.dataset.nemoImageId)) {
                overlay.style.opacity = '1';
            }
        });
        wrapper.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
        });
    }

    // Click handler for regeneration
    img.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if we have stored Pollinations data (either original or from previous processing)
        if (!img.dataset.pollinationsData && !img.src.includes('image.pollinations.ai')) {
            console.warn(`${LOG_PREFIX} No Pollinations data available for regeneration`);
            return;
        }

        // Queue for regeneration
        queueImage(img);
    });
}

/**
 * Process all Pollinations images in a message automatically
 * @param {HTMLElement} messageElement - The message element
 * @param {boolean} parallel - Whether to process images in parallel
 */
export async function interceptAllPollinationsImages(messageElement, parallel = true) {
    if (!messageElement) return;

    const images = Array.from(messageElement.querySelectorAll('img[src*="image.pollinations.ai"]'));

    if (images.length === 0) {
        console.log(`${LOG_PREFIX} No Pollinations images found`);
        return;
    }

    console.log(`${LOG_PREFIX} Found ${images.length} Pollinations images to process`);

    if (parallel) {
        // Process all at once
        await Promise.all(images.map(img => processPollinationsImage(img)));
    } else {
        // Process sequentially
        for (const img of images) {
            await processPollinationsImage(img);
        }
    }
}

/**
 * Extract all Pollinations prompts from a message without replacing
 * @param {HTMLElement|string} messageOrHtml - Message element or HTML string
 * @returns {Array<Object>} Array of parsed prompt data
 */
export function extractPollinationsPrompts(messageOrHtml) {
    let html;
    if (typeof messageOrHtml === 'string') {
        html = messageOrHtml;
    } else {
        html = messageOrHtml.innerHTML;
    }

    const matches = [];
    let match;

    // Reset regex
    POLLINATIONS_URL_REGEX.lastIndex = 0;

    while ((match = POLLINATIONS_URL_REGEX.exec(html)) !== null) {
        const fullUrl = match[0];
        const parsed = parsePollinationsUrl(fullUrl);
        if (parsed) {
            matches.push({
                url: fullUrl,
                ...parsed
            });
        }
    }

    return matches;
}

/**
 * Start observing for Pollinations images in real-time during streaming
 * This catches images as they appear, not waiting for message to complete
 */
function startStreamingObserver() {
    // Don't create multiple observers
    if (streamingObserver) {
        return;
    }

    const chatContainer = document.getElementById('chat');
    if (!chatContainer) {
        console.warn(`${LOG_PREFIX} Chat container not found for streaming observer`);
        return;
    }

    console.log(`${LOG_PREFIX} Starting streaming observer for real-time image detection`);

    streamingObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Check added nodes for images
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if the added node is an img with Pollinations URL
                if (node.tagName === 'IMG' && node.src?.includes('image.pollinations.ai')) {
                    if (!node.dataset.nemoIntercepted) {
                        console.log(`${LOG_PREFIX} [STREAMING] Detected new Pollinations image`);
                        processNewPollinationsImage(node);
                    }
                }

                // Check if added node contains img elements (e.g., a panel div was added)
                if (node.querySelectorAll) {
                    const images = node.querySelectorAll('img[src*="image.pollinations.ai"]');
                    images.forEach(img => {
                        if (!img.dataset.nemoIntercepted) {
                            console.log(`${LOG_PREFIX} [STREAMING] Detected Pollinations image in added element`);
                            processNewPollinationsImage(img);
                        }
                    });
                }
            }

            // Also check for attribute changes (src being set on existing img)
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                const img = mutation.target;
                if (img.tagName === 'IMG' && img.src?.includes('image.pollinations.ai')) {
                    if (!img.dataset.nemoIntercepted) {
                        console.log(`${LOG_PREFIX} [STREAMING] Detected src change to Pollinations URL`);
                        processNewPollinationsImage(img);
                    }
                }
            }
        }
    });

    streamingObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });
}

/**
 * Check whether the message stream has emitted content after an image.
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if there is later content in the same message
 */
function hasContentAfterImage(img) {
    const messageElement = img.closest('.mes_text');
    if (!messageElement || !document.contains(img) || !messageElement.lastChild) {
        return false;
    }

    const range = document.createRange();
    try {
        range.setStartAfter(img);
        range.setEndAfter(messageElement.lastChild);
        const fragment = range.cloneContents();
        return fragment.textContent.trim().length > 0 || fragment.querySelector('img, div, p, br, hr, table, ul, ol, pre, blockquote') !== null;
    } catch (error) {
        logger.warn(`${LOG_PREFIX} Could not inspect streamed content after image:`, error);
        return false;
    } finally {
        if (typeof range.detach === 'function') {
            range.detach();
        }
    }
}

/**
 * Clear pending streaming processing for an image.
 * @param {HTMLImageElement} img - The image element
 */
function clearPendingStreamingImage(img) {
    const pendingTimer = pendingStreamingImageTimers.get(img);
    if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingStreamingImageTimers.delete(img);
    }
    delete img.dataset.nemoStreamingDetectedAt;
}

/**
 * Schedule a streamed image for processing once the stream advances past it.
 * @param {HTMLImageElement} img - The image element
 */
function scheduleStreamingImageProcessing(img) {
    if (!document.contains(img) || img.src.startsWith('data:')) {
        clearPendingStreamingImage(img);
        return;
    }

    if (!img.dataset.nemoStreamingDetectedAt) {
        img.dataset.nemoStreamingDetectedAt = String(Date.now());
    }

    const existingTimer = pendingStreamingImageTimers.get(img);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        pendingStreamingImageTimers.delete(img);
        maybeQueueStreamingImage(img);
    }, STREAMING_IMAGE_READY_CHECK_DELAY_MS);

    pendingStreamingImageTimers.set(img, timer);
}

/**
 * Queue a streamed image only after later content appears, or leave it for final render.
 * @param {HTMLImageElement} img - The image element
 */
function maybeQueueStreamingImage(img) {
    if (!document.contains(img) || img.src.startsWith('data:') || !img.src.includes('image.pollinations.ai')) {
        clearPendingStreamingImage(img);
        return;
    }

    if (isImageQueuedOrProcessing(img)) {
        clearPendingStreamingImage(img);
        return;
    }

    if (hasContentAfterImage(img)) {
        console.log(`${LOG_PREFIX} [STREAMING] Stream advanced past Pollinations image; queueing regeneration`);
        queueImage(img);
        return;
    }

    const detectedAt = parseInt(img.dataset.nemoStreamingDetectedAt, 10) || Date.now();
    if (Date.now() - detectedAt < STREAMING_IMAGE_MAX_WAIT_MS) {
        scheduleStreamingImageProcessing(img);
        return;
    }

    // The final CHARACTER_MESSAGE_RENDERED event will catch last-panel images.
    console.log(`${LOG_PREFIX} [STREAMING] Waiting for final render before regenerating Pollinations image`);
    clearPendingStreamingImage(img);
}

/**
 * Process a newly detected Pollinations image after the stream advances
 * @param {HTMLImageElement} img - The image element
 */
function processNewPollinationsImage(img) {
    // Skip if already a data URL
    if (img.src.startsWith('data:')) {
        return;
    }

    // Generate unique ID and mark as intercepted
    img.dataset.nemoImageId = `nemo-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    img.dataset.nemoIntercepted = 'true';

    // Set up click-to-regenerate
    setupClickToRegenerate(img);

    // Wait until the stream has emitted later content before processing.
    scheduleStreamingImageProcessing(img);
}

/**
 * Get the message element by message ID
 * @param {number} messageId - The message index
 * @returns {HTMLElement|null} The message text element
 */
function getMessageElement(messageId) {
    const messageBlock = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (messageBlock) {
        return messageBlock.querySelector('.mes_text');
    }
    return null;
}

/**
 * Scan all messages in chat for Pollinations images
 */
function scanAllMessages() {
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        const messages = chatContainer.querySelectorAll('.mes_text');
        console.log(`${LOG_PREFIX} Scanning ${messages.length} existing messages`);
        messages.forEach(messageElement => {
            try {
                scanMessageForPollinationsImages(messageElement, false);
            } catch (error) {
                logger.error(`${LOG_PREFIX} Error scanning existing message:`, error);
            }
        });
    }
}

/**
 * Initialize the Pollinations interceptor
 * Uses SillyTavern's event system to detect new messages
 */
export function initPollinationsInterceptor() {
    console.log(`${LOG_PREFIX} Initializing Pollinations Interceptor`);

    // Add CSS for the interceptor UI
    if (!document.getElementById('nemo-pollinations-interceptor-styles')) {
        const style = document.createElement('style');
        style.id = 'nemo-pollinations-interceptor-styles';
        style.textContent = `
            .nemo-pollinations-loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .nemo-pollinations-loading-content i {
                font-size: 24px;
            }

            img[data-nemo-intercepted="true"] {
                transition: opacity 0.3s, filter 0.3s;
            }

            .nemo-regen-overlay {
                font-family: var(--mainFontFamily, sans-serif);
            }

            .nemo-regen-overlay i {
                margin-right: 4px;
            }

            /* Hide overlay when image is processing */
            img[data-nemo-intercepted="true"]:not([style*="opacity: 1"]) + .nemo-regen-overlay,
            img[data-nemo-intercepted="true"][style*="opacity: 0.5"] ~ .nemo-regen-overlay {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Listen for character (AI) messages being rendered - process immediately
    if (event_types.CHARACTER_MESSAGE_RENDERED) {
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            console.log(`${LOG_PREFIX} CHARACTER_MESSAGE_RENDERED event for message ${messageId}`);
            const messageElement = getMessageElement(messageId);
            if (messageElement) {
                scanMessageForPollinationsImages(messageElement);
            }
        });
    }

    // Listen for message swipes (switching between alternate versions)
    if (event_types.MESSAGE_SWIPED) {
        eventSource.on(event_types.MESSAGE_SWIPED, (data) => {
            const messageId = typeof data === 'object' ? data.id : data;
            console.log(`${LOG_PREFIX} MESSAGE_SWIPED event for message ${messageId}`);
            const messageElement = getMessageElement(messageId);
            if (messageElement) {
                // Reset interception flags for swiped message (new content)
                messageElement.querySelectorAll('img[data-nemo-intercepted]').forEach(img => {
                    delete img.dataset.nemoIntercepted;
                    delete img.dataset.pollinationsData;
                    delete img.dataset.originalPollinationsUrl;
                });
                scanMessageForPollinationsImages(messageElement);
            }
        });
    }

    // Listen for message edits
    if (event_types.MESSAGE_EDITED) {
        eventSource.on(event_types.MESSAGE_EDITED, (messageId) => {
            console.log(`${LOG_PREFIX} MESSAGE_EDITED event for message ${messageId}`);
            const messageElement = getMessageElement(messageId);
            if (messageElement) {
                scanMessageForPollinationsImages(messageElement);
            }
        });
    }

    // Listen for chat loaded/changed (scan all existing messages)
    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            console.log(`${LOG_PREFIX} CHAT_CHANGED event - scanning all messages`);
            scanAllMessages();
        });
    }

    // Start the streaming observer for real-time detection during message generation
    startStreamingObserver();

    // Scan existing messages on init
    scanAllMessages();

    console.log(`${LOG_PREFIX} Pollinations Interceptor initialized with streaming observer + event listeners`);
    logger.info('Pollinations Interceptor initialized');
}

// Export for manual use
export default {
    init: initPollinationsInterceptor,
    parseUrl: parsePollinationsUrl,
    scan: scanMessageForPollinationsImages,
    interceptAll: interceptAllPollinationsImages,
    extractPrompts: extractPollinationsPrompts,
    queueImage: queueImage,
    getQueueLength: () => imageQueue.length,
    isProcessing: () => activeQueueProcesses > 0 || imageQueue.length > 0
};
