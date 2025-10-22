

import React from 'react';
import Header from './components/Header';
import ApiKeysSetup from './components/ApiKeysSetup';
import CharacterEditor from './components/CharacterEditor';
import ExpressionPackGenerator from './components/ExpressionPackGenerator';
import PromptEditorModal from './components/PromptEditorModal';
import CharacterConception from './components/CharacterConception';
import CoreGenerationSetup from './components/CoreGenerationSetup';
import ReferenceManager from './components/ReferenceManager';
import Showcase from './components/Showcase';
import { ProfileSelector } from './components/ProfileSelector';
import { useGeneratorContext } from './contexts/GeneratorContext';

const App: React.FC = () => {
    const {
        view,
        appStep,
        error,
        isPromptEditorOpen,
        prompts,
        setPrompts,
        setIsPromptEditorOpen,
        referenceCharacters,
        handleAddReferences,
        handleRemoveReference,
    } = useGeneratorContext();

    if (appStep === 'apiKeysSetup') {
        return (
            <div className="min-h-screen font-body text-sepia-dark flex justify-center p-4 pt-48">
                <ApiKeysSetup />
            </div>
        );
    }

    const renderCreatorContent = () => {
        switch (appStep) {
            case 'conception':
                return <CharacterConception />;
            case 'coreGenerationSetup':
                return <>
                    <ReferenceManager references={referenceCharacters} onAddReferences={handleAddReferences} onRemoveReference={handleRemoveReference} />
                    <CoreGenerationSetup />
                </>;
            case 'generatingCore':
            case 'reviewAndWorldbuild':
                return <CharacterEditor />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen font-body text-sepia-dark">
            <main className="container mx-auto p-4 md:p-8 space-y-8">
                {isPromptEditorOpen && (
                    <PromptEditorModal
                        currentPrompts={prompts}
                        onSave={setPrompts}
                        onClose={() => setIsPromptEditorOpen(false)}
                    />
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-900 p-4 rounded-lg">
                        <p className="font-bold">An Error Occurred</p>
                        <p>{error}</p>
                    </div>
                )}
                
                <Header />
                <ProfileSelector />
                <Showcase />

                {view === 'creator' ? renderCreatorContent() : <ExpressionPackGenerator />}
            </main>
        </div>
    );
};

export default App;