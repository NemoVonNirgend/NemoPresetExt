/**
 * Image Generation Service
 * Handles image generation from multiple sources: Gemini, NovelAI, and Pollinations.ai
 */

import type { ImageSource, ImageGenerationOptions } from '../types/imageGeneration';

interface ImageGenerationOptionsInternal extends ImageGenerationOptions {
    negativePrompt?: string;
}

/**
 * Generate image using Google Gemini Imagen
 */
export async function generateGeminiImage(
    apiKey: string,
    prompt: string,
    options: ImageGenerationOptionsInternal = {}
): Promise<string> {
    const { width = 768, height = 1024, seed } = options;

    // Calculate aspect ratio
    const ratio = width / height;
    const ratios: Record<string, number> = {
        '1:1': 1,
        '3:4': 0.75,
        '4:3': 1.33,
        '9:16': 0.5625,
        '16:9': 1.78
    };

    let aspectRatio = '1:1';
    let minDiff = Math.abs(ratio - 1);
    for (const [key, value] of Object.entries(ratios)) {
        const diff = Math.abs(ratio - value);
        if (diff < minDiff) {
            minDiff = diff;
            aspectRatio = key;
        }
    }

    const model = 'imagen-3.0-generate-002';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const requestBody = {
        instances: [{
            prompt: prompt
        }],
        parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio,
            personGeneration: 'allow_all',
            safetySetting: 'block_low_and_above',
            outputOptions: {
                mimeType: 'image/jpeg',
                compressionQuality: 100
            },
            ...(seed !== undefined && { seed })
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini image generation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
        throw new Error('No image data returned from Gemini');
    }

    return `data:image/jpeg;base64,${imageBase64}`;
}

/**
 * Generate image using NovelAI
 */
export async function generateNovelAIImage(
    apiKey: string,
    prompt: string,
    options: ImageGenerationOptionsInternal = {}
): Promise<string> {
    const { width = 768, height = 1024, negativePrompt = '', seed } = options;

    const requestBody = {
        input: prompt,
        model: 'nai-diffusion-3',
        action: 'generate',
        parameters: {
            width,
            height,
            scale: 5,
            sampler: 'k_euler_ancestral',
            steps: 28,
            n_samples: 1,
            ucPreset: 0,
            qualityToggle: true,
            sm: false,
            sm_dyn: false,
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            cfg_rescale: 0,
            noise_schedule: 'native',
            legacy_v3_extend: false,
            negative_prompt: negativePrompt,
            ...(seed !== undefined && { seed: String(seed) })
        }
    };

    const response = await fetch('https://api.novelai.net/ai/generate-image', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NovelAI image generation failed: ${response.status} ${errorText}`);
    }

    // NovelAI returns a zip file with the image
    const blob = await response.blob();

    // Convert blob to base64
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Generate image using Pollinations.ai (no API key required)
 */
export async function generatePollinationsImage(
    prompt: string,
    options: ImageGenerationOptionsInternal = {}
): Promise<string> {
    const { width = 768, height = 1024, negativePrompt, seed = Math.floor(Math.random() * 1000000) } = options;

    // Build quality and style tags
    const qualityTags = [
        'anime',
        'masterpiece',
        'best quality',
        'amazing quality',
        'very aesthetic',
        'absurdres',
        'newest',
        'highly detailed',
        'high quality',
        'artist:krekkov'
    ];

    // Build negative prompt
    const defaultNegative = [
        'worst quality',
        'low quality',
        'blurry',
        'jpeg artifacts',
        'ugly',
        'disfigured',
        'deformed',
        'mutated hands',
        'extra limbs',
        'extra fingers',
        'poorly drawn face',
        'poorly drawn hands',
        'mutated',
        'extra head',
        'floating limbs',
        'disconnected limbs',
        'malformed',
        'bad anatomy',
        'bad proportions'
    ];

    const fullNegative = negativePrompt
        ? [...defaultNegative, ...negativePrompt.split(',').map(s => s.trim())]
        : defaultNegative;

    // Construct the full prompt with quality tags
    const fullPrompt = [...qualityTags, prompt].join(' ');

    // URL encode
    const encodedPrompt = fullPrompt.replace(/ /g, '%20');
    const encodedNegative = fullNegative.join('%20');

    // Build URL
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=illustrious&seed=${seed}&negative_prompt=${encodedNegative}&nologo=true`;

    // Fetch the image
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Pollinations image generation failed: ${response.status}`);
    }

    // Convert to base64
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Generate image using the specified source
 */
export async function generateImage(
    source: ImageSource,
    prompt: string,
    options: ImageGenerationOptions & { apiKey?: string } = {}
): Promise<string> {
    const { apiKey, ...imageOptions } = options;

    switch (source) {
        case 'gemini':
            if (!apiKey) throw new Error('Gemini API key is required');
            return generateGeminiImage(apiKey, prompt, imageOptions);

        case 'novelai':
            if (!apiKey) throw new Error('NovelAI API key is required');
            return generateNovelAIImage(apiKey, prompt, imageOptions);

        case 'pollinations':
            return generatePollinationsImage(prompt, imageOptions);

        default:
            throw new Error(`Unknown image source: ${source}`);
    }
}
