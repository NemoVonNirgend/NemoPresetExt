
import React from 'react';

interface ApiKeyInputProps {
    apiKey: string;
    setApiKey: (key: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, setApiKey }) => {
    return (
        <div className="bg-zinc-900/70 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-zinc-800 max-w-lg mx-auto">
            <label htmlFor="api-key-input" className="block text-lg font-medium text-zinc-200 mb-2">
                Your Gemini API Key
            </label>
            <input
                id="api-key-input"
                type="password"
                className="block w-full p-2 text-base bg-zinc-800 border-zinc-700 focus:outline-none focus:ring-fuchsia-500 focus:border-fuchsia-500 sm:text-sm rounded-md text-white"
                placeholder="Enter your API key here to begin"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                aria-required="true"
            />
            <p className="text-xs text-zinc-400 mt-2">
                Your key is stored in your browser's local storage and is only sent to Google's Gemini API.
            </p>
        </div>
    );
};

export default ApiKeyInput;
