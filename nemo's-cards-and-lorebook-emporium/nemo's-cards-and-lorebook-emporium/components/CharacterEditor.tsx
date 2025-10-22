


import React, { useState } from 'react';
import type { CharacterData, RegeneratableField } from '../types';
import Button from './Button';
// FIX: The import for EditableField was causing an error because the component was not being exported correctly. This is now fixed in EditableField.tsx.
import EditableField from './EditableField';
import Tooltip from './Tooltip';
import JsonDisplay from './JsonDisplay';
import LorebookDisplay from './LorebookDisplay';
import LorebookSettingsForm from './LorebookSettingsForm';
import ExpressionProgressGrid from './ExpressionProgressGrid';
import ImageGenerationInterface from './ImageGenerationInterface';
import { useGeneratorContext } from '../contexts/GeneratorContext';
import LoadingSpinner from './LoadingSpinner';
import { sillyTavernIntegration } from '../sillytavern-integration';

const CharacterEditor: React.FC = () => {
    const {
        characterCard,
        handleUpdateCard,
        handleGenerateLorebookAndExpressions,
        handleGenerateImages,
        handleRefineImage,
        handleStartOver,
        setIsPromptEditorOpen,
        handleDownloadExpressionPack,
        appStep,
        characterImage,
        isLoading,
        lorebookSettings,
        setLorebookSettings,
        expressionPackProgress,
        imageCandidates,
        geminiImageError,
        novelaiImageError,
        isLoadingGeminiImage,
        isLoadingNovelaiImage,
        selectedImageSource,
        setSelectedImageSource,
        handleApproveImage,
        isRefiningImage,
        imageRefinementPrompt,
        setImageRefinementPrompt,
        isRegeneratingField,
        handleRegenerateField,
        handleSaveToShowcase,
        showcaseItems,
        imageGenSource,
        imageGenApiKey,
        setImageGenSource,
        setImageGenApiKey,
    } = useGeneratorContext();

    const [isLorebookSettingsOpen, setIsLorebookSettingsOpen] = useState(false);
    const [isRefinementPanelOpen, setIsRefinementPanelOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const isInSillyTavern = sillyTavernIntegration.isInSillyTavern();

    if (!characterCard) return null;

    const { data } = characterCard;
    const isImageBusy = isLoadingGeminiImage || isLoadingNovelaiImage || isRefiningImage;
    
    const isAlreadySaved = showcaseItems.some(item => item.name === data.name);
    const hasExpressionProgress = Object.keys(expressionPackProgress).length > 0;
    const hasCompletedExpressions = Object.values(expressionPackProgress).some((e: { status: 'loading' | 'done' | 'error' }) => e.status === 'done');

    const handleFieldChange = (field: keyof CharacterData, value: any) => {
        handleUpdateCard({ ...data, [field]: value });
    };

    const handleGreetingChange = (index: number, value: string) => {
        const newGreetings = [...data.alternate_greetings];
        newGreetings[index] = value;
        handleFieldChange('alternate_greetings', newGreetings);
    };

    const addGreeting = () => {
        const newGreetings = [...data.alternate_greetings, ''];
        handleFieldChange('alternate_greetings', newGreetings);
    };

    const removeGreeting = (index: number) => {
        const newGreetings = data.alternate_greetings.filter((_, i) => i !== index);
        handleFieldChange('alternate_greetings', newGreetings);
    };

    const handleInitiateRefinement = () => {
        setIsRefinementPanelOpen(true);
    };

    const handleConfirmRefinement = () => {
        handleRefineImage();
        setIsRefinementPanelOpen(false);
    };

    const handleImportToSillyTavern = async () => {
        setIsImporting(true);
        try {
            let lorebookName = null;

            // If there's a lorebook, import it first so we can link it to the character
            if (characterCard.data.character_book) {
                lorebookName = characterCard.data.character_book.name || `${characterCard.data.name}_lorebook`;
                console.log('[Emporium] Importing lorebook first:', lorebookName);

                await sillyTavernIntegration.importLorebook(characterCard.data.character_book);
            }

            // Prepare character data for import with lorebook name
            const characterDataToImport = {
                ...characterCard,
                image: characterImage,
                lorebookName: lorebookName, // Pass lorebook name for linking
            };

            console.log('[Emporium] Importing character with lorebook link:', lorebookName);
            await sillyTavernIntegration.importCharacter(characterDataToImport);

            console.log('[Emporium] Import completed successfully');
        } catch (error) {
            console.error('[Emporium] Import failed:', error);
        } finally {
            setIsImporting(false);
        }
    };

    const editorDisabled = appStep === 'generatingCore' || isLoading;
    const canGenerateWorld = appStep === 'reviewAndWorldbuild' && characterImage && !isLoading;

    const isFieldRegenerating = (fieldName: RegeneratableField) => isRegeneratingField === fieldName;

    return (
        <div className="space-y-8">
             {appStep === 'generatingCore' && (
                <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-8 text-center">
                    <LoadingSpinner />
                    <h2 className="mt-4 text-2xl font-heading font-bold text-sepia-dark">Generating Character...</h2>
                    <p className="text-sepia">The AI is crafting the core personality and details. Please wait.</p>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left Column: Image & Actions */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-28">
                    <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 overflow-hidden">
                        {characterImage ? (
                             <div className="aspect-[3/4] w-full object-cover bg-parchment-dark flex items-center justify-center">
                                <img className="h-full w-full object-cover" src={characterImage} alt={data.name} />
                             </div>
                        ) : (
                             appStep === 'reviewAndWorldbuild' && (
                                <div className="p-4">
                                     <ImageGenerationInterface
                                        geminiImage={imageCandidates.gemini}
                                        novelaiImage={imageCandidates.novelai}
                                        isLoadingGemini={isLoadingGeminiImage}
                                        isLoadingNovelai={isLoadingNovelaiImage}
                                        geminiError={geminiImageError}
                                        novelaiError={novelaiImageError}
                                        selectedImageSource={selectedImageSource}
                                        imageGenSource={imageGenSource}
                                        imageGenApiKey={imageGenApiKey}
                                        onSelectImage={setSelectedImageSource}
                                        onApprove={handleApproveImage}
                                        onStartRefinement={handleInitiateRefinement}
                                        onGenerate={handleGenerateImages}
                                        onSourceChange={setImageGenSource}
                                        onApiKeyChange={setImageGenApiKey}
                                    />
                                </div>
                            )
                        )}
                        
                         {isRefinementPanelOpen && (
                            <div className="p-4 border-t border-leather/20 bg-parchment-dark/50">
                                <h3 className="text-md font-semibold text-sepia-dark">Refine Selected Image</h3>
                                <textarea
                                    rows={2}
                                    className="block w-full mt-2 p-2 text-sm bg-parchment-dark/70 border-sepia-light rounded-md text-sepia-dark"
                                    placeholder="e.g., Change hair to blue, add a smile..."
                                    value={imageRefinementPrompt}
                                    onChange={(e) => setImageRefinementPrompt(e.target.value)}
                                    disabled={isImageBusy}
                                />
                                <Button onClick={handleConfirmRefinement} isLoading={isRefiningImage} disabled={!imageRefinementPrompt.trim()} className="mt-2 w-full" variant="secondary">
                                   Refine Image
                                </Button>
                            </div>
                        )}
                    </div>
                    
                    <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-4 space-y-3">
                         {canGenerateWorld && !isLorebookSettingsOpen && (
                            <Button onClick={() => setIsLorebookSettingsOpen(true)} className="w-full">
                                Approve Card & Proceed to World Building
                            </Button>
                         )}

                         {isLorebookSettingsOpen && (
                            <Button onClick={handleGenerateLorebookAndExpressions} isLoading={isLoading} className="w-full">
                                {isLoading ? 'Generating...' : 'Generate Lorebook & Expression Pack'}
                             </Button>
                         )}

                         {isLoading && (
                             <Button isLoading={true} disabled={true} className="w-full">
                                {Object.keys(expressionPackProgress).length > 0 ? 'Generating World & Expressions...' : 'Generating...'}
                             </Button>
                         )}
                        
                        {isInSillyTavern && characterImage && (
                            <Button
                                onClick={handleImportToSillyTavern}
                                isLoading={isImporting}
                                disabled={!characterImage || isLoading || isImporting}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg"
                                title="Import this character directly into SillyTavern"
                            >
                                📥 Import to SillyTavern
                            </Button>
                        )}

                        <Button
                            onClick={handleSaveToShowcase}
                            disabled={!characterImage || isLoading || isAlreadySaved}
                            title={isAlreadySaved ? `${data.name} is already in the emporium.` : "Save this character to your collection."}
                            variant="secondary"
                            className="w-full"
                        >
                            {isAlreadySaved ? 'Saved to Emporium' : 'Add to Emporium'}
                        </Button>

                        {hasCompletedExpressions && !isLoading && (
                            <Button onClick={handleDownloadExpressionPack} variant="secondary" className="w-full">
                                Download Expression Pack (.zip)
                            </Button>
                         )}

                        <Button onClick={() => setIsPromptEditorOpen(true)} variant="secondary" className="w-full">
                            Edit Generation Prompts
                        </Button>
                         <Button onClick={handleStartOver} disabled={isLoading || isImageBusy} variant="secondary" className="w-full border-red-800/30 text-red-900 hover:bg-red-500/20">
                            Start Over
                        </Button>
                    </div>

                    {hasExpressionProgress && (
                        <ExpressionProgressGrid expressions={expressionPackProgress} />
                    )}
                </div>

                {/* Right Column: Editor Fields */}
                <div className="lg:col-span-2 space-y-6">
                    {isLorebookSettingsOpen && (
                        <details open className="group">
                             <summary className="list-none text-xl font-heading font-bold text-sepia-dark cursor-pointer flex justify-between items-center mb-4">
                                World Building Settings
                                <svg className="w-6 h-6 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </summary>
                            <LorebookSettingsForm
                                settings={lorebookSettings}
                                setSettings={setLorebookSettings}
                                disabled={isLoading}
                            />
                        </details>
                    )}

                    <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-4">
                        <div>
                            <label className="flex items-center text-sm font-bold text-sepia-dark mb-1 uppercase tracking-wider">
                                Name
                            </label>
                             <input
                                type="text"
                                value={data.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                className="block w-full p-2 text-2xl font-heading font-bold bg-transparent border-none focus:ring-0 text-sepia-dark"
                                disabled={editorDisabled}
                            />
                        </div>
                        <EditableField
                            label="Creator's Notes"
                            tooltipText="Notes for other users. This will be displayed in the character list. Good for describing the bot, giving tips, or listing tested models. HTML is supported."
                            value={data.creator_notes}
                            onChange={(val) => handleFieldChange('creator_notes', val)}
                            rows={4}
                            disabled={editorDisabled}
                            onRegenerate={() => handleRegenerateField('creator_notes')}
                            isRegenerating={isFieldRegenerating('creator_notes')}
                        />
                    </div>
                     <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-4">
                        <EditableField
                            label="Description"
                            tooltipText="The main description of the character's physical appearance, personality traits, and backstory. This is one of the most important fields for defining the character."
                            value={data.description}
                            onChange={(val) => handleFieldChange('description', val)}
                            rows={12}
                            disabled={editorDisabled}
                            onRegenerate={() => handleRegenerateField('description')}
                            isRegenerating={isFieldRegenerating('description')}
                        />
                    </div>
                      <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-4">
                         <div>
                            <div className="flex items-center justify-between">
                                <label className="flex items-center text-sm font-bold text-sepia-dark mb-1 uppercase tracking-wider">
                                    First Message
                                    <Tooltip text="The very first message the character sends to start the chat. It should set the scene and establish the initial situation." />
                                </label>
                                <button
                                    onClick={() => handleRegenerateField('first_mes')}
                                    disabled={editorDisabled || isFieldRegenerating('first_mes')}
                                    className="flex items-center gap-1 text-xs text-leather hover:text-leather/80 disabled:opacity-50 disabled:cursor-wait"
                                    title="Regenerate this field"
                                >
                                    {isFieldRegenerating('first_mes') ? <LoadingSpinner /> : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path d="M10.03 2.22a.75.75 0 01.72.02l4.25 2.5a.75.75 0 010 1.32l-4.25 2.5a.75.75 0 01-.72 0l-4.25-2.5a.75.75 0 010-1.32l4.25-2.5a.75.75 0 010-.02zM6.5 6.4v5.1a.75.75 0 00.47.7l3.75 2.25a.75.75 0 00.76 0l3.75-2.25a.75.75 0 00.47-.7V6.4l-4.25 2.5a.75.75 0 01-.72 0L6.5 6.4zM3.86 4.78a.75.75 0 000 1.32l4.25 2.5a.75.75 0 00.72 0l4.25-2.5a.75.75 0 000-1.32L8.83 2.2a.75.75 0 00-.72 0L3.86 4.78z" />
                                            <path d="M4.25 12.43a.75.75 0 01.75-.68h10a.75.75 0 01.75.68v.01a.75.75 0 01-.75.68h-10a.75.75 0 01-.75-.68v-.01zM4.25 15.18a.75.75 0 01.75-.68h10a.75.75 0 01.75.68v.01a.75.75 0 01-.75.68h-10a.75.75 0 01-.75-.68v-.01z" />
                                        </svg>
                                    )}
                                    <span>Regenerate</span>
                                </button>
                            </div>
                             <textarea
                                rows={6}
                                className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark disabled:opacity-60"
                                value={data.first_mes}
                                onChange={(val) => handleFieldChange('first_mes', val.target.value)}
                                disabled={editorDisabled || isFieldRegenerating('first_mes')}
                            />
                        </div>
                        <div>
                            <label className="flex items-center text-sm font-bold text-sepia-dark mb-2 uppercase tracking-wider">
                                Alternate Greetings
                                <Tooltip text="Additional starting messages. A random one will be chosen when a new chat begins. Helps with replayability." />
                            </label>
                            <div className="space-y-2">
                                {data.alternate_greetings.map((greeting, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <textarea
                                            rows={2}
                                            value={greeting}
                                            onChange={(e) => handleGreetingChange(index, e.target.value)}
                                            className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light rounded-md text-sepia-dark"
                                            disabled={editorDisabled}
                                        />
                                        <button onClick={() => removeGreeting(index)} className="text-red-800 hover:text-red-900 p-1" aria-label="Remove greeting" disabled={editorDisabled}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                ))}
                                <Button onClick={addGreeting} variant="secondary" className="text-xs px-3 py-1" disabled={editorDisabled}>Add Greeting</Button>
                            </div>
                        </div>
                    </div>

                    <details className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 group">
                        <div className="p-6">
                            <summary className="list-none text-xl font-heading font-bold text-sepia-dark cursor-pointer flex justify-between items-center">
                                Advanced Definitions
                                <svg className="w-6 h-6 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </summary>
                            <div className="mt-6 space-y-6 border-t border-leather/20 pt-6">
                                <EditableField
                                    label="Personality"
                                    tooltipText="A summary of the character's personality. Can be more direct and less narrative than the main Description."
                                    value={data.personality}
                                    onChange={(val) => handleFieldChange('personality', val)}
                                    rows={6}
                                    disabled={editorDisabled}
                                    onRegenerate={() => handleRegenerateField('personality')}
                                    isRegenerating={isFieldRegenerating('personality')}
                                />
                                <EditableField
                                    label="Scenario"
                                    tooltipText="The circumstances and context of the interaction. Where is the user? What is the situation?"
                                    value={data.scenario}
                                    onChange={(val) => handleFieldChange('scenario', val)}
                                    rows={4}
                                    disabled={editorDisabled}
                                    onRegenerate={() => handleRegenerateField('scenario')}
                                    isRegenerating={isFieldRegenerating('scenario')}
                                />
                                <EditableField
                                    label="Main Prompt (System Prompt)"
                                    tooltipText="High-level instructions for the AI on how to play the character. Defines core traits, motivations, and rules for the AI's behavior."
                                    value={data.system_prompt || ''}
                                    onChange={(val) => handleFieldChange('system_prompt', val)}
                                    rows={8}
                                    disabled={editorDisabled}
                                />
                                 <EditableField
                                    label="Post-History Instructions"
                                    tooltipText="Instructions for the AI that are injected into the context after the chat history. Useful for guiding the AI's responses based on recent events."
                                    value={data.post_history_instructions || ''}
                                    onChange={(val) => handleFieldChange('post_history_instructions', val)}
                                    rows={6}
                                    disabled={editorDisabled}
                                />
                                <div>
                                    <label className="flex items-center text-sm font-bold text-sepia-dark mb-1 uppercase tracking-wider">
                                        Tags
                                        <Tooltip text="Comma-separated list of tags. Used for searching and organizing characters." />
                                    </label>
                                    <input
                                        type="text"
                                        value={data.tags.join(', ')}
                                        onChange={(e) => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()))}
                                        className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light rounded-md text-sepia-dark"
                                        placeholder="e.g., fantasy, elf, tsundere, magic"
                                        disabled={editorDisabled}
                                    />
                                </div>
                            </div>
                        </div>
                    </details>
                    
                    {characterCard.data.character_book.entries.length > 0 && (
                        <div className="space-y-8">
                             <LorebookDisplay characterBook={characterCard.data.character_book} />
                             <JsonDisplay characterCard={characterCard} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CharacterEditor;