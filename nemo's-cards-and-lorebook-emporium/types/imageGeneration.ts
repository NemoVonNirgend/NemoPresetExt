export type ImageSource = 'gemini' | 'novelai' | 'pollinations';

export interface ImageGenerationOptions {
    width?: number;
    height?: number;
    seed?: number;
    apiKey?: string;
}
