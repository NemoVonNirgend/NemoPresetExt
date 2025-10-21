import React, { useState } from 'react';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import type { ImageSource } from '../types/imageGeneration';

interface ImageGenerationInterfaceProps {
    geminiImage: string | null;
    novelaiImage: string | null;
    isLoadingGemini: boolean;
    isLoadingNovelai: boolean;
    geminiError: string | null;
    novelaiError: string | null;
    selectedImageSource: 'gemini' | 'novelai' | null;
    imageGenSource: ImageSource;
    imageGenApiKey: string;
    onSelectImage: (source: 'gemini' | 'novelai') => void;
    onApprove: () => void;
    onStartRefinement: () => void;
    onGenerate: () => void;
    onSourceChange: (source: ImageSource) => void;
    onApiKeyChange: (key: string) => void;
}

const ImageBox: React.FC<{
    label: string;
    image: string | null;
    isLoading: boolean;
    error: string | null;
    isSelected: boolean;
    onClick: () => void;
}> = ({ label, image, isLoading, error, isSelected, onClick }) => (
    <div className="flex flex-col items-center">
        <h4 className="text-lg font-semibold text-sepia-dark mb-2">{label}</h4>
        <div
            onClick={onClick}
            className={`aspect-[3/4] w-full bg-parchment-dark rounded-lg flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-200 ${isSelected ? 'ring-4 ring-leather shadow-lg' : 'ring-2 ring-transparent hover:ring-sepia-light'}`}
        >
            {isLoading ? (
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="text-sepia mt-2 text-sm">Generating...</p>
                </div>
            ) : error ? (
                 <div className="p-4 text-center text-red-800">
                    <p className="font-bold">Generation Failed</p>
                    <p className="text-xs mt-1">{error}</p>
                </div>
            ) : image ? (
                <img src={image} alt={label} className="w-full h-full object-cover" />
            ) : (
                 <div className="p-4 text-center text-sepia-light">
                    <p>Image will appear here.</p>
                </div>
            )}
        </div>
    </div>
);

const ImageGenerationInterface: React.FC<ImageGenerationInterfaceProps> = ({
    geminiImage, novelaiImage, isLoadingGemini, isLoadingNovelai, geminiError, novelaiError,
    selectedImageSource, imageGenSource, imageGenApiKey, onSelectImage, onApprove, onStartRefinement,
    onGenerate, onSourceChange, onApiKeyChange
}) => {
    const showInitialGenerateButton = !geminiImage && !novelaiImage && !isLoadingGemini && !isLoadingNovelai && !geminiError && !novelaiError;
    const [showSettings, setShowSettings] = useState(false);

    if (showInitialGenerateButton) {
        return (
            <div className="aspect-[3/4] w-full flex flex-col items-center justify-center gap-4 p-4">
                {!showSettings ? (
                    <>
                        <Button onClick={onGenerate}>Generate Character Art</Button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="text-xs text-sepia-light hover:text-sepia underline"
                        >
                            Image Generation Settings
                        </button>
                    </>
                ) : (
                    <div className="w-full space-y-3">
                        <h4 className="text-center font-semibold text-sepia-dark">Image Generation Settings</h4>

                        <div>
                            <label className="block text-sm text-sepia-dark mb-1">Source</label>
                            <select
                                value={imageGenSource}
                                onChange={(e) => onSourceChange(e.target.value as ImageSource)}
                                className="w-full p-2 bg-parchment-dark border border-sepia-light rounded text-sepia-dark"
                            >
                                <option value="pollinations">Pollinations.ai (Free, No API Key)</option>
                                <option value="gemini">Google Gemini Imagen</option>
                                <option value="novelai">NovelAI</option>
                            </select>
                        </div>

                        {imageGenSource !== 'pollinations' && (
                            <div>
                                <label className="block text-sm text-sepia-dark mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={imageGenApiKey}
                                    onChange={(e) => onApiKeyChange(e.target.value)}
                                    placeholder={`Enter your ${imageGenSource === 'gemini' ? 'Google AI Studio' : 'NovelAI'} API key`}
                                    className="w-full p-2 bg-parchment-dark border border-sepia-light rounded text-sepia-dark placeholder-sepia-light/50"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button onClick={onGenerate} className="flex-1">Generate</Button>
                            <Button onClick={() => setShowSettings(false)} variant="secondary">Cancel</Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ImageBox
                    label="Google Gemini"
                    image={geminiImage}
                    isLoading={isLoadingGemini}
                    error={geminiError}
                    isSelected={selectedImageSource === 'gemini'}
                    onClick={() => geminiImage && onSelectImage('gemini')}
                />
                <ImageBox
                    label="NovelAI"
                    image={novelaiImage}
                    isLoading={isLoadingNovelai}
                    error={novelaiError}
                    isSelected={selectedImageSource === 'novelai'}
                    onClick={() => novelaiImage && onSelectImage('novelai')}
                />
            </div>

            {selectedImageSource && (
                <div className="p-4 bg-parchment-dark/50 rounded-lg mt-4 flex justify-center items-center gap-4">
                     <Button onClick={onApprove} variant="primary">Approve Image</Button>
                     <Button onClick={onStartRefinement} variant="secondary">Revise Image</Button>
                </div>
            )}
            
            {(geminiError || novelaiError) && (!isLoadingGemini && !isLoadingNovelai) && (
                 <div className="text-center mt-4">
                     <Button onClick={onGenerate} variant="secondary">Try Again</Button>
                 </div>
            )}
        </div>
    );
};

export default ImageGenerationInterface;