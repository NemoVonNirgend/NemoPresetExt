import React from 'react';
import { useGeneratorContext } from '../contexts/GeneratorContext';
import Button from './Button';

const ApiKeysSetup: React.FC = () => {
    const {
        geminiApiKey, setGeminiApiKey,
        novelaiApiKey, setNovelaiApiKey,
        deepseekApiKey, setDeepseekApiKey,
        handleKeysSet
    } = useGeneratorContext();

    return (
        <div className="max-w-lg mx-auto border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-6">
            <div>
                <label htmlFor="gemini-api-key-input" className="block text-lg font-medium text-sepia-dark mb-2">
                    Your Gemini API Key (Required)
                </label>
                <input
                    id="gemini-api-key-input"
                    type="password"
                    className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                    placeholder="Enter your Gemini API key"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    aria-required="true"
                />
                <p className="text-xs text-sepia mt-2">
                    Used for all text generation, lorebooks, and Google's image generation/editing.
                </p>
            </div>
            <div>
                <label htmlFor="novelai-api-key-input" className="block text-lg font-medium text-sepia-dark mb-2">
                    Your NovelAI API Key (Optional)
                </label>
                <input
                    id="novelai-api-key-input"
                    type="password"
                    className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                    placeholder="Enter your NovelAI API key for image comparison"
                    value={novelaiApiKey}
                    onChange={(e) => setNovelaiApiKey(e.target.value)}
                />
                <p className="text-xs text-sepia mt-2">
                    Used for side-by-side image generation comparison.
                </p>
            </div>
             <div>
                <label htmlFor="deepseek-api-key-input" className="block text-lg font-medium text-sepia-dark mb-2">
                    DeepSeek API Key (for NSFW)
                </label>
                <input
                    id="deepseek-api-key-input"
                    type="password"
                    className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                    placeholder="Enter key for optional erotic content generation"
                    value={deepseekApiKey}
                    onChange={(e) => setDeepseekApiKey(e.target.value)}
                />
                <p className="text-xs text-sepia mt-2">
                    Used for the final, optional step of generating explicit character details.
                </p>
            </div>
             <Button
                onClick={handleKeysSet}
                disabled={!geminiApiKey.trim()}
                className="w-full"
            >
                Continue
            </Button>
        </div>
    );
};

export default ApiKeysSetup;