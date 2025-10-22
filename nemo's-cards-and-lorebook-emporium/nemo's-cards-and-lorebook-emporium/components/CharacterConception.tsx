import React, { useState, useEffect, useMemo } from 'react';
import ChatInterface from './ChatInterface';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import ReferenceManager from './ReferenceManager';
import { useGeneratorContext } from '../contexts/GeneratorContext';
import SelectInput from './SelectInput';
import { GENRES, STYLES, AUTHORS } from '../constants';
import Tooltip from './Tooltip';


const CharacterConception: React.FC = () => {
    const {
        characterName, setCharacterName, characterConcept, setCharacterConcept,
        chatHistory, handleConceptionSubmit, isConceptionAiResponding, handleProceedToCoreGeneration,
        isNameValidating, nameValidation, aiSuggestions,
        referenceCharacters, handleAddReferences, handleRemoveReference, handleGenerateConceptFromReferences, isGeneratingConcept,
        isSuggestingInspirations, inspirationSuggestions, handleSuggestInspirations, setInspirationSuggestions,
        genre, setGenre, style, setStyle, author, setAuthor, authorSuggestions, isSuggestingAuthors, handleSuggestAuthors
    } = useGeneratorContext();

    const hasJsonReferences = referenceCharacters.some(ref => 'spec' in ref);
    const [selectedInspirations, setSelectedInspirations] = useState<Set<string>>(new Set());
    
    const authorOptions = useMemo(() => {
        const allAuthors = new Set([...AUTHORS, ...authorSuggestions]);
        if (author && !allAuthors.has(author)) {
            allAuthors.add(author);
        }
        return Array.from(allAuthors);
    }, [author, authorSuggestions]);

    useEffect(() => {
        setSelectedInspirations(new Set());
    }, [inspirationSuggestions]);

    const handleInspirationToggle = (inspiration: string) => {
        setSelectedInspirations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(inspiration)) {
                newSet.delete(inspiration);
            } else {
                newSet.add(inspiration);
            }
            return newSet;
        });
    };

    const handleUseInspirations = () => {
        if (selectedInspirations.size > 0) {
            const inspirationText = Array.from(selectedInspirations).join(', ');
            handleConceptionSubmit(`Let's use these for inspiration: ${inspirationText}. How can we blend their themes?`);
            setInspirationSuggestions([]);
        }
    };

    return (
        <div className="space-y-8">
            <div className="text-center">
                 <h2 className="text-3xl font-heading font-bold text-sepia-dark">Step 1: Character Conception</h2>
                 <p className="text-sepia mt-1">Define your character's core idea, name, and creative tone.</p>
            </div>

            <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 max-w-3xl mx-auto p-6 space-y-4">
                 <h3 className="text-xl font-heading font-bold text-sepia-dark">Remix Mode (Optional)</h3>
                 <p className="text-sepia text-sm">
                    Have some characters you like? Upload their JSON card files, and the AI will synthesize a completely new character concept inspired by them.
                 </p>
                <ReferenceManager
                    references={referenceCharacters}
                    onAddReferences={handleAddReferences}
                    onRemoveReference={handleRemoveReference}
                />
                <Button
                    onClick={handleGenerateConceptFromReferences}
                    isLoading={isGeneratingConcept}
                    disabled={!hasJsonReferences || isGeneratingConcept || isConceptionAiResponding}
                    className="w-full"
                >
                    {isGeneratingConcept ? 'Synthesizing Concept...' : 'Generate Concept from References'}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 h-[70vh] flex flex-col">
                    <div className="flex-grow h-0">
                        <ChatInterface
                            history={chatHistory}
                            onSendMessage={handleConceptionSubmit}
                            isAiResponding={isConceptionAiResponding}
                            suggestions={aiSuggestions}
                        />
                    </div>
                    {inspirationSuggestions.length > 0 && (
                        <div className="p-4 border-t border-leather/20 bg-parchment-dark/50 rounded-b-lg">
                            <p className="text-sm font-medium text-sepia-dark mb-2">Inspiration Suggestions (select one or more):</p>
                            <div className="flex flex-wrap gap-2">
                                {inspirationSuggestions.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => handleInspirationToggle(s)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                            selectedInspirations.has(s)
                                            ? 'bg-leather text-parchment ring-2 ring-leather/70'
                                            : 'bg-sepia-light/50 text-sepia-dark hover:bg-sepia-light/80'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {selectedInspirations.size > 0 && (
                                <Button onClick={handleUseInspirations} className="mt-4 w-full" variant="secondary">
                                    Use Selected Inspirations
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 self-start p-6 space-y-6">
                    <div>
                        <label htmlFor="character-name" className="block text-lg font-medium text-sepia-dark">
                            Character Name
                        </label>
                         <div className="relative mt-1">
                            <input
                                id="character-name"
                                type="text"
                                className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark pr-10"
                                placeholder="e.g., Kaelen Ironheart"
                                value={characterName}
                                onChange={(e) => setCharacterName(e.target.value)}
                                aria-describedby="name-validation-feedback"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                {isNameValidating && <LoadingSpinner />}
                                {nameValidation?.isValid && !isNameValidating && (
                                    <svg className="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                )}
                                {nameValidation && !nameValidation.isValid && !isNameValidating &&(
                                    <svg className="h-5 w-5 text-red-800" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                )}
                            </div>
                        </div>
                        {nameValidation && !nameValidation.isValid && (
                            <p id="name-validation-feedback" className="text-sm text-red-800 mt-2">{nameValidation.feedback}</p>
                        )}
                         {nameValidation?.suggestions && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {nameValidation.suggestions.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setCharacterName(s)}
                                        className="px-2 py-1 text-xs rounded-full bg-sepia-light/50 text-sepia-dark hover:bg-sepia-light/80"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <SelectInput
                            id="genre-select"
                            label="Genre"
                            options={GENRES}
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                        />
                        <SelectInput
                            id="style-select"
                            label="Style"
                            options={STYLES}
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                        />
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                 <label htmlFor="author-select" className="flex items-center text-sm font-medium text-sepia">
                                    Author Personality
                                    <Tooltip text="Sets the AI's creative voice and writing style for generating all content, from descriptions to lore. Each persona has a unique flair." />
                                </label>
                                <button
                                    onClick={handleSuggestAuthors}
                                    disabled={isSuggestingAuthors}
                                    className="text-sm font-semibold text-leather hover:text-leather/80 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                                >
                                    {isSuggestingAuthors ? (
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : '✨'}
                                    Suggest
                                </button>
                            </div>
                            <select
                                id="author-select"
                                className="block w-full pl-3 pr-10 py-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                            >
                                {authorOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                         {authorSuggestions.length > 0 && !isSuggestingAuthors && (
                            <div className="pt-2">
                                <p className="text-xs font-medium text-sepia-light mb-2">Suggestions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {authorSuggestions.map(suggestion => (
                                        <button
                                            key={suggestion}
                                            onClick={() => setAuthor(suggestion)}
                                            className="px-2 py-1 text-xs rounded-full bg-sepia-light/50 text-sepia-dark hover:bg-sepia-light/80"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                     <div className="space-y-4">
                        <label htmlFor="user-prompt" className="block text-lg font-medium text-sepia-dark">
                            Character Concept
                        </label>
                        <p className="text-sm text-sepia -mt-3 mb-2">The AI will update this as you chat. You can also edit it manually.</p>
                        <textarea
                            id="user-prompt"
                            rows={8}
                            className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                            placeholder="e.g., A shy elven princess who secretly practices forbidden healing magic."
                            value={characterConcept}
                            onChange={(e) => setCharacterConcept(e.target.value)}
                        />
                        <Button
                            onClick={handleSuggestInspirations}
                            isLoading={isSuggestingInspirations}
                            disabled={isConceptionAiResponding || isSuggestingInspirations || !characterConcept.trim()}
                            variant="secondary"
                            className="w-full"
                        >
                            Suggest Inspirations
                        </Button>
                    </div>
                    <Button
                        onClick={handleProceedToCoreGeneration}
                        disabled={!characterConcept.trim() || !characterName.trim()}
                        className="w-full"
                    >
                        Finalize Concept & Proceed
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CharacterConception;