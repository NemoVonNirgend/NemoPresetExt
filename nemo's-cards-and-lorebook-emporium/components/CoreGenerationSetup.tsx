import React from 'react';
import Button from './Button';
import { useGeneratorContext } from '../contexts/GeneratorContext';

const CoreGenerationSetup: React.FC = () => {
    const {
        characterName,
        characterConcept,
        genre,
        style,
        author,
        handleGenerateCoreCard,
        isLoading,
        setIsPromptEditorOpen,
    } = useGeneratorContext();

    return (
        <div className="max-w-3xl mx-auto space-y-8">
             <div className="text-center">
                 <h2 className="text-3xl font-heading font-bold text-sepia-dark">Step 2: Review & Generate</h2>
                 <p className="text-sepia mt-1">Review your character concept and settings, add any final reference materials, then generate the draft.</p>
            </div>

            <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-6">
                <h3 className="text-xl font-heading font-bold text-sepia-dark">Final Review</h3>
                <div className="space-y-3 text-sm p-4 bg-parchment-dark/50 rounded-lg border border-leather/20">
                    <div className="flex justify-between items-center">
                        <span className="text-sepia">Name:</span>
                        <span className="font-semibold text-sepia-dark text-right">{characterName}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sepia">Genre:</span>
                        <span className="font-semibold text-sepia-dark text-right">{genre}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sepia">Style:</span>
                        <span className="font-semibold text-sepia-dark text-right">{style}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sepia">Author:</span>
                        <span className="font-semibold text-sepia-dark text-right">{author}</span>
                    </div>
                    <div>
                        <span className="text-sepia block mb-1">Concept:</span>
                        <p className="p-3 bg-parchment-dark/70 rounded-md text-sepia-dark max-h-32 overflow-y-auto text-xs">
                            {characterConcept}
                        </p>
                    </div>
                </div>
                <div className="pt-6 border-t border-leather/20 space-y-3">
                    <Button
                        onClick={() => setIsPromptEditorOpen(true)}
                        variant="secondary"
                        className="w-full"
                    >
                        Customize Generation Prompts
                    </Button>
                    <Button
                        onClick={handleGenerateCoreCard}
                        isLoading={isLoading}
                        className="w-full"
                    >
                        {isLoading ? 'Generating Draft...' : 'Generate Character Draft'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CoreGenerationSetup;