import React, { useState, useMemo } from 'react';
import type { GenerationPrompts } from '../types';
import { defaultPrompts } from '../prompts';
import Button from './Button';

interface PromptEditorModalProps {
    currentPrompts: GenerationPrompts;
    onSave: (newPrompts: GenerationPrompts) => void;
    onClose: () => void;
}

type PromptKey = keyof GenerationPrompts | `lorebookParts.${keyof GenerationPrompts['lorebookParts']}`;

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ currentPrompts, onSave, onClose }) => {
    const [editedPrompts, setEditedPrompts] = useState<GenerationPrompts>(JSON.parse(JSON.stringify(currentPrompts)));
    const [selectedKey, setSelectedKey] = useState<PromptKey>('coreCardSystem');

    const promptList = useMemo((): { key: PromptKey; label: string }[] => [
        { key: 'coreCardSystem', label: 'Core Card Generation' },
        { key: 'lorebookSystem', label: 'Lorebook Generation (Overall)' },
        { key: 'lorebookParts.keyNPCs', label: 'Lorebook: Key NPCs' },
        { key: 'lorebookParts.minorNPCs', label: 'Lorebook: Minor NPCs' },
        { key: 'lorebookParts.locations', label: 'Lorebook: Locations' },
        { key: 'lorebookParts.factions', label: 'Lorebook: Factions' },
        { key: 'lorebookParts.worldMechanics', label: 'Lorebook: World Mechanics' },
        { key: 'lorebookParts.roleplayingEngine', label: 'Lorebook: Roleplaying Engine' },
        { key: 'conceptRefinement', label: 'Concept Refinement Chat' },
    ], []);

    const getValueByKey = (key: PromptKey, source: GenerationPrompts): string => {
        if (key.startsWith('lorebookParts.')) {
            const subKey = key.split('.')[1] as keyof GenerationPrompts['lorebookParts'];
            return source.lorebookParts[subKey];
        }
        return source[key as keyof GenerationPrompts] as string;
    };

    const handleValueChange = (key: PromptKey, value: string) => {
        setEditedPrompts(prev => {
            const newPrompts = JSON.parse(JSON.stringify(prev));
            if (key.startsWith('lorebookParts.')) {
                const subKey = key.split('.')[1] as keyof GenerationPrompts['lorebookParts'];
                newPrompts.lorebookParts[subKey] = value;
            } else {
                newPrompts[key as keyof GenerationPrompts] = value;
            }
            return newPrompts;
        });
    };

    const handleResetToDefault = () => {
        const defaultValue = getValueByKey(selectedKey, defaultPrompts);
        handleValueChange(selectedKey, defaultValue);
    };

    const handleSave = () => {
        onSave(editedPrompts);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-parchment border border-leather/50 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <header className="p-4 border-b border-leather/20 flex justify-between items-center">
                    <h2 className="text-xl font-heading font-bold text-sepia-dark">Edit Generation Prompts</h2>
                    <button onClick={onClose} className="text-sepia-light hover:text-sepia-dark text-2xl">&times;</button>
                </header>
                <div className="flex-grow flex overflow-hidden">
                    <aside className="w-1/3 border-r border-leather/20 overflow-y-auto bg-parchment-dark/30">
                        <nav>
                            <ul>
                                {promptList.map(({ key, label }) => (
                                    <li key={key}>
                                        <button
                                            onClick={() => setSelectedKey(key)}
                                            className={`w-full text-left p-3 text-sm font-medium transition-colors ${selectedKey === key ? 'bg-leather text-parchment' : 'hover:bg-leather/10 text-sepia-dark'}`}
                                        >
                                            {label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>
                    <main className="w-2/3 flex flex-col p-4">
                        <div className="flex-grow">
                             <textarea
                                value={getValueByKey(selectedKey, editedPrompts)}
                                onChange={(e) => handleValueChange(selectedKey, e.target.value)}
                                className="w-full h-full p-2 text-sm bg-parchment-dark/50 border-sepia-light rounded-md text-sepia-dark resize-none font-mono"
                            />
                        </div>
                        <div className="text-xs text-sepia mt-2">
                           {'Note: Placeholders like `{{characterName}}` are filled in automatically during generation.'}
                        </div>
                    </main>
                </div>
                <footer className="p-4 border-t border-leather/20 flex justify-between items-center bg-parchment-dark/30 rounded-b-lg">
                    <Button onClick={handleResetToDefault} variant="secondary">
                        Reset Current Prompt to Default
                    </Button>
                    <div className="flex gap-4">
                        <Button onClick={onClose} variant="secondary">Cancel</Button>
                        <Button onClick={handleSave} variant="primary">Save and Close</Button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PromptEditorModal;